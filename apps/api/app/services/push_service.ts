import db from '@adonisjs/lucid/services/db'
import type { BatchResponse } from 'firebase-admin/messaging'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import PushRegistration from '#models/push_registration'
import FcmClient from '#notifications/fcm_client'

export type PushMessage = {
  title: string
  body: string
  /** In-app path opened when the notification is clicked. */
  url?: string | null
  /** Replaces an earlier notification with the same tag. */
  tag?: string
}

/** FCM error codes meaning the installation is gone and must be forgotten. */
const UNREGISTERED_CODES = new Set([
  'messaging/installation-id-not-registered',
  'messaging/registration-token-not-registered',
])

/** FIDs whose send failed because FCM no longer knows the installation. */
export function unregisteredFids(fids: string[], response: BatchResponse) {
  return response.responses.flatMap((result, index) =>
    !result.success && result.error && UNREGISTERED_CODES.has(result.error.code)
      ? [fids[index]]
      : []
  )
}

/**
 * Web push through Firebase Cloud Messaging (free tier), addressed by
 * Firebase Installation ID. Disabled (no-op) unless FIREBASE_* env vars are set.
 */
@inject()
export default class PushService {
  constructor(private fcm: FcmClient) {}

  get isEnabled() {
    return this.fcm.isConfigured
  }

  /**
   * An installation belongs to one browser; registering it again from another
   * account moves it to the current user.
   */
  /**
   * One row per FID, owned by the last user who registered it. An atomic
   * upsert: the browser may send the same FID twice at once (the explicit
   * call and Firebase's onRegistered), and find-then-insert raced into a
   * unique violation.
   */
  async register(userId: string, fid: string) {
    const now = new Date()
    await db
      .knexQuery()
      .table('push_registrations')
      .insert({ user_id: userId, fid, created_at: now, updated_at: now })
      .onConflict('fid')
      .merge({ user_id: userId, updated_at: now })
    return await PushRegistration.findByOrFail('fid', fid)
  }

  async unregister(userId: string, fid: string) {
    await PushRegistration.query().where({ userId, fid }).delete()
  }

  async isRegistered(userId: string, fid: string) {
    const registration = await PushRegistration.query().where({ userId, fid }).first()
    return Boolean(registration)
  }

  async sendToUser(userId: string, message: PushMessage) {
    if (!this.isEnabled) return

    const registrations = await PushRegistration.query().where('userId', userId)
    if (registrations.length === 0) return

    const fids = registrations.map((registration) => registration.fid)
    const gone = await this.send(fids, message, { userId })
    if (gone.length > 0) {
      await PushRegistration.query().whereIn('fid', gone).delete()
    }
  }

  /** A customer's browser asks to be told when the order is ready. Repeating it is harmless. */
  async subscribeToOrder(orderId: string, fid: string) {
    await db
      .knexQuery()
      .table('order_push_subscriptions')
      .insert({ order_id: orderId, fid, created_at: new Date() })
      .onConflict(['order_id', 'fid'])
      .ignore()
  }

  async unsubscribeFromOrder(orderId: string, fid: string) {
    await db.from('order_push_subscriptions').where({ order_id: orderId, fid }).delete()
  }

  /** The order is over (delivered, cancelled): nothing more to tell these browsers. */
  async forgetOrder(orderId: string) {
    await db.from('order_push_subscriptions').where('order_id', orderId).delete()
  }

  /** A customer's browsers waiting for news of their order (no account). */
  async sendToOrder(orderId: string, message: PushMessage) {
    if (!this.isEnabled) return

    const rows = await db.from('order_push_subscriptions').where('order_id', orderId).select('fid')
    if (rows.length === 0) return

    const fids = rows.map((row) => row.fid as string)
    const gone = await this.send(fids, message, { orderId })
    if (gone.length > 0) {
      await db
        .from('order_push_subscriptions')
        .where('order_id', orderId)
        .whereIn('fid', gone)
        .delete()
    }
  }

  /** Sends to the installations; answers the ones FCM no longer knows. */
  private async send(fids: string[], message: PushMessage, context: Record<string, string>) {
    // Data-only message: public/sw.js renders it, so the app controls the
    // notification and skips it while a tab is focused (the page shows it).
    const response = await this.fcm.send(fids, {
      title: message.title,
      body: message.body,
      url: message.url ?? '',
      tag: message.tag ?? '',
    })

    const gone = unregisteredFids(fids, response)
    if (response.failureCount > gone.length) {
      logger.warn(
        { ...context, failures: response.failureCount - gone.length },
        'FCM delivery failed for some installations'
      )
    }
    return gone
  }
}
