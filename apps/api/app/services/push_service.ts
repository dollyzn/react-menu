import webpush, { type WebPushError } from 'web-push'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import PushSubscription from '#models/push_subscription'

export type PushSubscriptionPayload = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export type PushMessage = {
  title: string
  body: string
  url?: string | null
  tag?: string
}

/**
 * Web push delivery. Disabled (no-op) unless VAPID_* env vars are set.
 */
export default class PushService {
  #configured = false

  get isEnabled() {
    return Boolean(
      env.get('VAPID_PUBLIC_KEY') && env.get('VAPID_PRIVATE_KEY') && env.get('VAPID_CONTACT')
    )
  }

  #configure() {
    if (this.#configured) return
    webpush.setVapidDetails(
      `mailto:${env.get('VAPID_CONTACT')}`,
      env.get('VAPID_PUBLIC_KEY')!,
      env.get('VAPID_PRIVATE_KEY')!
    )
    this.#configured = true
  }

  /**
   * Endpoints are unique per browser; re-subscribing from a browser that
   * belonged to another user moves the subscription to the current one.
   */
  async subscribe(userId: string, payload: PushSubscriptionPayload) {
    return await PushSubscription.updateOrCreate(
      { endpoint: payload.endpoint },
      { userId, p256dh: payload.keys.p256dh, auth: payload.keys.auth }
    )
  }

  async unsubscribe(userId: string, endpoint: string) {
    await PushSubscription.query().where({ userId, endpoint }).delete()
  }

  async isSubscribed(userId: string, endpoint: string) {
    const subscription = await PushSubscription.query().where({ userId, endpoint }).first()
    return Boolean(subscription)
  }

  async sendToUser(userId: string, message: PushMessage) {
    if (!this.isEnabled) return
    this.#configure()

    const subscriptions = await PushSubscription.query().where('userId', userId)

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(message)
          )
        } catch (error) {
          const statusCode = (error as WebPushError).statusCode
          // The browser revoked or expired this subscription.
          if (statusCode === 404 || statusCode === 410) {
            await subscription.delete()
            return
          }
          logger.warn({ err: error, userId }, 'web push delivery failed')
        }
      })
    )
  }
}
