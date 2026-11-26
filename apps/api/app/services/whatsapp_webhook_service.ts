import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import WhatsAppAccount from '#models/whatsapp_account'
import CustomerLoginService from '#services/customer_login_service'
import WhatsAppMessageService from '#services/whatsapp_message_service'
import type { InboundMessage, WebhookPayload } from '#whatsapp/webhook'

/** The text a customer sent (a typed message, or a button's label). */
function textOf(message: InboundMessage) {
  if (message.type === 'text') return message.text?.body ?? ''
  if (message.type === 'button') return message.button?.text ?? ''
  return ''
}

/**
 * What reaches our override callback (ADR 0025): only the `messages` field
 * (template and account events go to the app's default callback). Statuses
 * update the messages we sent; inbound messages may carry a login code.
 * Every item is handled on its own (one failure never drops the rest); if
 * any failed, `handle` throws so the answer is a 500 and Meta delivers the
 * batch again, which is safe: statuses only move forward, a challenge is
 * verified once and replies are deduplicated.
 */
@inject()
export default class WhatsAppWebhookService {
  constructor(
    private messages: WhatsAppMessageService,
    private login: CustomerLoginService
  ) {}

  #failed = false

  async handle(payload: WebhookPayload) {
    if (payload.object !== 'whatsapp_business_account') return
    this.#failed = false
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages' || !change.value) continue
        const phoneNumberId = change.value.metadata?.phone_number_id
        if (!phoneNumberId) continue
        // Another product's number on the same app: not ours.
        const account = await WhatsAppAccount.findBy('phoneNumberId', phoneNumberId)
        if (!account) continue

        for (const status of change.value.statuses ?? []) {
          await this.safely('status', account, () => this.messages.applyStatus(account, status))
        }
        for (const message of change.value.messages ?? []) {
          const text = textOf(message)
          if (!text) continue
          await this.safely('inbound message', account, () =>
            this.login.receiveMessage(account, message.from, text)
          )
        }
      }
    }
    if (this.#failed) throw new Error('Some WhatsApp webhook items failed; Meta will deliver again')
  }

  private async safely(what: string, account: WhatsAppAccount, run: () => Promise<unknown>) {
    try {
      await run()
    } catch (error) {
      this.#failed = true
      logger.error({ err: error, storeId: account.storeId }, `could not handle a WhatsApp ${what}`)
    }
  }
}
