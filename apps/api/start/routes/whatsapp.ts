import router from '@adonisjs/core/services/router'

const WhatsAppWebhookController = () => import('#controllers/whatsapp_webhook_controller')

/**
 * WhatsApp Cloud webhook (ADR 0025): the override callback of every WABA we
 * connect. Public; authenticated by the verify token and the signature.
 */
export default function whatsappWebhookRoutes() {
  router
    .get('/webhooks/whatsapp', [WhatsAppWebhookController, 'verify'])
    .as('whatsapp.webhook.verify')
  router
    .post('/webhooks/whatsapp', [WhatsAppWebhookController, 'receive'])
    .as('whatsapp.webhook.receive')
}
