import { randomUUID } from 'node:crypto'
import logger from '@adonisjs/core/services/logger'
import WhatsAppClient, {
  type PhoneNumberInfo,
  type SendResult,
  type TemplateInfo,
} from '#whatsapp/client'
import { TEMPLATE_DEFINITIONS, TEMPLATE_LANGUAGE } from '#whatsapp/templates'

export type FakeSent = {
  phoneNumberId: string
  to: string
  body: Record<string, unknown>
  at: Date
}

/**
 * Development and e2e (WHATSAPP_FAKE, never in production): Meta is never
 * called. Connecting accepts any code, our templates read as approved and
 * messages are only logged and kept in memory (the e2e hooks read them).
 */
export default class FakeWhatsAppClient extends WhatsAppClient {
  /** Last messages sent, newest last (shared by every instance of the process). */
  static sent: FakeSent[] = []

  async exchangeCode(code: string) {
    return `fake-token-${code}`
  }

  async phoneNumber(_token: string, phoneNumberId: string): Promise<PhoneNumberInfo> {
    return {
      id: phoneNumberId,
      display_phone_number: '+55 11 90000-0000',
      verified_name: 'Loja de teste',
      quality_rating: 'GREEN',
      platform_type: 'CLOUD_API',
    }
  }

  async grantedWabas(token: string) {
    return [`9${token.replace(/\D/g, '').padEnd(12, '0').slice(0, 12)}`]
  }

  async phoneNumbers(token: string, wabaId: string): Promise<PhoneNumberInfo[]> {
    return [await this.phoneNumber(token, `8${wabaId.slice(1)}`)]
  }

  async registerPhone() {}

  async subscribeApp() {}

  async unsubscribeApp() {}

  async listTemplates(): Promise<TemplateInfo[]> {
    return TEMPLATE_DEFINITIONS.map((definition) => ({
      id: `fake-${definition.name}`,
      name: definition.name,
      language: TEMPLATE_LANGUAGE,
      status: 'APPROVED',
      category: definition.category,
    }))
  }

  async createTemplate(_token: string, _wabaId: string, body: Record<string, unknown>) {
    return { id: `fake-${String(body.name)}`, status: 'APPROVED', category: String(body.category) }
  }

  protected async send(
    _token: string,
    phoneNumberId: string,
    body: Record<string, unknown>
  ): Promise<SendResult> {
    const to = String(body.to)
    FakeWhatsAppClient.sent.push({ phoneNumberId, to, body, at: new Date() })
    if (FakeWhatsAppClient.sent.length > 200) FakeWhatsAppClient.sent.shift()
    logger.info({ to, type: body.type, body }, 'WhatsApp (fake) message')
    return {
      messages: [{ id: `wamid.fake-${randomUUID()}` }],
      contacts: [{ input: to, wa_id: to }],
    }
  }
}
