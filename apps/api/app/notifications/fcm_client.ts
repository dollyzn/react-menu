import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getMessaging, type BatchResponse } from 'firebase-admin/messaging'
import env from '#start/env'

/**
 * Thin firebase-admin wrapper (FCM by Firebase Installation ID). Injected
 * into PushService so tests can swap it, like MercadoPagoClient.
 */
export default class FcmClient {
  get isConfigured() {
    return Boolean(
      env.get('FIREBASE_PROJECT_ID') &&
      env.get('FIREBASE_CLIENT_EMAIL') &&
      env.get('FIREBASE_PRIVATE_KEY')
    )
  }

  #app(): App {
    return (
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: env.get('FIREBASE_PROJECT_ID'),
          clientEmail: env.get('FIREBASE_CLIENT_EMAIL'),
          // Env files keep the PEM on one line with escaped newlines.
          privateKey: env.get('FIREBASE_PRIVATE_KEY')!.replace(/\\n/g, '\n'),
        }),
      })
    )
  }

  /** Data-only message to each installation; one result per FID, in order. */
  async send(fids: string[], data: Record<string, string>): Promise<BatchResponse> {
    return await getMessaging(this.#app()).sendEachForMulticast({
      fids,
      data,
      webpush: { headers: { Urgency: 'high', TTL: String(60 * 60 * 24) } },
    })
  }
}
