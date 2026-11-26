import app from '@adonisjs/core/services/app'
import type { Group } from '@japa/runner/core'
import type Store from '#models/store'
import WhatsAppAccount, { type TemplateState } from '#models/whatsapp_account'
import WhatsAppClient, {
  type PhoneNumberInfo,
  type SendResult,
  type TemplateInfo,
  WhatsAppApiError,
} from '#whatsapp/client'
import { TEMPLATE_DEFINITIONS, TEMPLATE_LANGUAGE } from '#whatsapp/templates'
import { signBody } from '#whatsapp/webhook'

export const APP_SECRET = 'test-app-secret'
export const VERIFY_TOKEN = 'test-verify-token'
export const PHONE_NUMBER_ID = '106540352242922'
export const WABA_ID = '102290129340398'

/** Meta's Graph API side for tests (ADR 0025): records every call. */
export class FakeGraph extends WhatsAppClient {
  calls: { method: string; args: unknown[] }[] = []
  sent: { to: string; body: Record<string, unknown> }[] = []
  templates: TemplateInfo[] = []
  /** The next send fails with this error (then clears). */
  failNextSend: WhatsAppApiError | null = null
  private wamid = 1

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args })
  }

  called(method: string) {
    return this.calls.filter((call) => call.method === method)
  }

  async exchangeCode(code: string) {
    this.record('exchangeCode', code)
    if (code === 'expired-code-0000') {
      throw new WhatsAppApiError('This authorization code has expired.', 400, 100, 36007)
    }
    return `business-token-${code}`
  }

  async phoneNumber(token: string, phoneNumberId: string): Promise<PhoneNumberInfo> {
    this.record('phoneNumber', token, phoneNumberId)
    return {
      id: phoneNumberId,
      display_phone_number: '+55 11 3333-4444',
      verified_name: 'JJ Pastéis',
      platform_type: 'CLOUD_API',
    }
  }

  async registerPhone(token: string, phoneNumberId: string, pin: string) {
    this.record('registerPhone', token, phoneNumberId, pin)
  }

  async subscribeApp(token: string, wabaId: string, callbackUrl: string, verifyToken: string) {
    this.record('subscribeApp', token, wabaId, callbackUrl, verifyToken)
  }

  async unsubscribeApp(token: string, wabaId: string) {
    this.record('unsubscribeApp', token, wabaId)
  }

  async listTemplates(token: string, wabaId: string) {
    this.record('listTemplates', token, wabaId)
    return this.templates
  }

  async createTemplate(token: string, wabaId: string, body: Record<string, unknown>) {
    this.record('createTemplate', token, wabaId, body)
    const created = {
      id: `tpl-${this.templates.length + 1}`,
      name: String(body.name),
      language: String(body.language),
      status: 'PENDING',
      category: String(body.category),
    }
    this.templates.push(created)
    return { id: created.id, status: created.status, category: created.category }
  }

  /** Meta approves every template we created. */
  approveAll() {
    for (const template of this.templates) template.status = 'APPROVED'
  }

  protected async send(
    _token: string,
    _phoneNumberId: string,
    body: Record<string, unknown>
  ): Promise<SendResult> {
    if (this.failNextSend) {
      const error = this.failNextSend
      this.failNextSend = null
      throw error
    }
    this.sent.push({ to: String(body.to), body })
    return { messages: [{ id: `wamid.TEST${this.wamid++}` }] }
  }
}

/** Swaps the Graph client for a FakeGraph for each test of the group. */
export function useFakeGraph(group: Group) {
  const holder: { graph: FakeGraph } = { graph: new FakeGraph() }
  group.each.setup(() => {
    holder.graph = new FakeGraph()
    app.container.swap(WhatsAppClient, () => holder.graph)
    return () => app.container.restore(WhatsAppClient)
  })
  return holder
}

/** A store already connected, with every template approved (or as given). */
export async function connectStore(
  store: Store,
  overrides: Partial<WhatsAppAccount> = {},
  status = 'APPROVED'
) {
  const templates: Record<string, TemplateState> = Object.fromEntries(
    TEMPLATE_DEFINITIONS.map((definition) => [
      definition.name,
      { id: `tpl-${definition.name}`, status, category: definition.category, reason: null },
    ])
  )
  return await WhatsAppAccount.create({
    storeId: store.id,
    wabaId: WABA_ID,
    phoneNumberId: `${PHONE_NUMBER_ID}${Math.floor(Math.random() * 1e6)}`,
    displayPhoneNumber: '+55 11 3333-4444',
    verifiedName: store.name,
    accessToken: 'business-token',
    registerPin: '123456',
    coexistence: false,
    notifyOrders: true,
    customerLogin: true,
    templates,
    ...overrides,
  })
}

/**
 * A webhook body as Meta sends it, signed with the app secret. The test
 * client sends `.json(payload)`, serialized by JSON.stringify like here.
 */
export function webhookBody(phoneNumberId: string, value: Record<string, unknown>) {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '551133334444', phone_number_id: phoneNumberId },
              ...value,
            },
          },
        ],
      },
    ],
  }
  return { payload, signature: signBody(JSON.stringify(payload), APP_SECRET) }
}

export { TEMPLATE_LANGUAGE }
