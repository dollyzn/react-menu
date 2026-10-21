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
  async register(userId: string, fid: string) {
    return await PushRegistration.updateOrCreate({ fid }, { userId })
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

    // Data-only message: public/sw.js renders it, so the app controls the
    // notification and skips it while a tab is focused (the in-app toast shows it).
    const response = await this.fcm.send(fids, {
      title: message.title,
      body: message.body,
      url: message.url ?? '',
      tag: message.tag ?? '',
    })

    const gone = unregisteredFids(fids, response)
    if (gone.length > 0) {
      await PushRegistration.query().whereIn('fid', gone).delete()
    }

    if (response.failureCount > gone.length) {
      logger.warn(
        { userId, failures: response.failureCount - gone.length },
        'FCM delivery failed for some installations'
      )
    }
  }
}
