import { inject } from '@adonisjs/core'
import { exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import AppJob from '#jobs/app_job'
import type WhatsAppMessage from '#models/whatsapp_message'
import WhatsAppMessageService from '#services/whatsapp_message_service'

type Payload = { messageId: string }

/**
 * Sends one queued WhatsApp message (ADR 0025). The row is created once per
 * notice, so a retry or a second dispatch never sends twice; only Meta not
 * answering or rate limits are retried.
 */
@inject()
export default class SendWhatsAppMessage extends AppJob<Payload> {
  static options: JobOptions = {
    maxRetries: 5,
    retry: { backoff: exponentialBackoff({ baseDelay: '10s', maxDelay: '10m' }) },
  }

  constructor(private messages: WhatsAppMessageService) {
    super()
  }

  static async dispatchFor(message: WhatsAppMessage) {
    await SendWhatsAppMessage.dispatch({ messageId: message.id }).dedup({
      id: message.id,
      ttl: '1h',
    })
  }

  async execute() {
    await this.messages.deliver(this.payload.messageId)
  }

  /** A missed notice isn't worth an e-mail to the admins (the panel bell is enough). */
  protected notifyFailureByEmail = false
}
