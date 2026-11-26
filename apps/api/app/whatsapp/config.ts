import app from '@adonisjs/core/services/app'
import env from '#start/env'

/** The development fake (no Meta), never in production. */
export function whatsappFake() {
  return Boolean(env.get('WHATSAPP_FAKE')) && !app.inProduction
}

/**
 * The platform's Tech Provider app (ADR 0025). WhatsApp is on when the app
 * is configured (or the development fake is).
 */
export function whatsappConfig() {
  const appId = env.get('WHATSAPP_APP_ID') || null
  const appSecret = env.get('WHATSAPP_APP_SECRET') || null
  const configId = env.get('WHATSAPP_CONFIG_ID') || null
  const verifyToken = env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') || null
  const fake = whatsappFake()
  return {
    enabled: fake || Boolean(appId && appSecret && configId && verifyToken),
    fake,
    appId,
    appSecret,
    configId,
    verifyToken,
    graphVersion: env.get('WHATSAPP_GRAPH_VERSION') || 'v24.0',
    webhookUrl:
      env.get('WHATSAPP_WEBHOOK_URL') ||
      `${env.get('APP_URL').replace(/\/$/, '')}/api/v1/webhooks/whatsapp`,
  }
}
