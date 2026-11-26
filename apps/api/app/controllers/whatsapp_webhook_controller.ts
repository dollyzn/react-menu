import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import AppException from '#exceptions/app_exception'
import { messageOnly } from '#helpers/api_response'
import WhatsAppWebhookService from '#services/whatsapp_webhook_service'
import { whatsappConfig } from '#whatsapp/config'
import { isValidSignature, type WebhookPayload } from '#whatsapp/webhook'

/**
 * The override callback of every WABA we connect (ADR 0025). Public: Meta
 * proves itself with the verify token (GET) and the app secret's signature
 * (POST).
 */
@inject()
export default class WhatsAppWebhookController {
  constructor(private webhooks: WhatsAppWebhookService) {}

  /** Meta checks the URL before accepting it as a WABA's override. */
  async verify({ request, response }: HttpContext) {
    const query = request.qs()
    const { verifyToken } = whatsappConfig()
    if (
      query['hub.mode'] !== 'subscribe' ||
      !verifyToken ||
      query['hub.verify_token'] !== verifyToken
    ) {
      throw new AppException('Verificação recusada.', 403, 'E_WEBHOOK_VERIFY')
    }
    response.header('Content-Type', 'text/plain; charset=utf-8')
    return String(query['hub.challenge'] ?? '')
  }

  async receive({ request }: HttpContext) {
    const { appSecret } = whatsappConfig()
    const raw = request.raw() ?? ''
    if (!appSecret || !isValidSignature(raw, request.header('x-hub-signature-256'), appSecret)) {
      logger.warn('WhatsApp webhook with an invalid signature')
      throw new AppException('Assinatura inválida.', 401, 'E_WEBHOOK_SIGNATURE')
    }
    await this.webhooks.handle(request.body() as WebhookPayload)
    return messageOnly('ok')
  }
}
