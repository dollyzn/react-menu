import logger from '@adonisjs/core/services/logger'
import { whatsappConfig } from '#whatsapp/config'

const GRAPH = 'https://graph.facebook.com'

/**
 * Graph API error codes that are worth retrying later: rate limits, Meta's
 * own hiccups. Everything else (a bad number, a template not approved, the
 * payment method) fails the same way on a retry.
 */
const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 613, 80007, 130429, 131000, 131016, 131056])

/** A Graph API refusal (or no answer), with Meta's code for the caller to react. */
export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 when Meta didn't answer. */
    public status: number,
    /** Meta's error code (190 token, 131042 payment, 131047 window…); null without an answer. */
    public code: number | null,
    public subcode: number | null = null,
    public details: string | null = null
  ) {
    super(message)
    this.name = 'WhatsAppApiError'
  }

  /** No answer, a 5xx or a rate limit: the same call may work later. */
  get transient() {
    return this.status === 0 || this.status >= 500 || TRANSIENT_CODES.has(this.code ?? -1)
  }

  /** The business token no longer works (revoked, expired, app removed). */
  get tokenInvalid() {
    return this.code === 190 || (this.code === 200 && this.subcode === 2494050)
  }

  /** Meta refused it for the WABA's payment method. */
  get paymentIssue() {
    return this.code === 131042
  }
}

export type PhoneNumberInfo = {
  id: string
  display_phone_number: string
  verified_name?: string
  quality_rating?: string
  code_verification_status?: string
  /** CLOUD_API once registered on the Cloud API. */
  platform_type?: string
}

export type TemplateInfo = {
  id: string
  name: string
  language: string
  status: string
  category: string
  rejected_reason?: string | null
}

export type SendResult = {
  messages?: { id: string; message_status?: string }[]
  contacts?: { input?: string; wa_id?: string }[]
}

type Paged<T> = { data?: T[]; paging?: { next?: string } }

/**
 * Minimal Graph API client for WhatsApp Cloud (ADR 0025). Every call is
 * made with the store's business token, except the signup code exchange,
 * which uses the app secret. Swapped by a fake in tests and development.
 */
export default class WhatsAppClient {
  /** Embedded Signup: the 5-minute code becomes the business token (server to server). */
  async exchangeCode(code: string): Promise<string> {
    const { appId, appSecret } = whatsappConfig()
    const query = new URLSearchParams({
      client_id: appId ?? '',
      client_secret: appSecret ?? '',
      code,
    })
    const result = await this.request<{ access_token?: string }>(
      null,
      'GET',
      `/oauth/access_token?${query}`
    )
    if (!result.access_token) {
      throw new WhatsAppApiError('Meta did not return a token', 502, null)
    }
    return result.access_token
  }

  async phoneNumber(token: string, phoneNumberId: string): Promise<PhoneNumberInfo> {
    const fields =
      'display_phone_number,verified_name,quality_rating,code_verification_status,platform_type'
    return await this.request(token, 'GET', `/${encode(phoneNumberId)}?fields=${fields}`)
  }

  /**
   * The WABAs a business token was granted (its `whatsapp_business_management`
   * scope), read with the app's own token (`debug_token`).
   */
  async grantedWabas(token: string): Promise<string[]> {
    const { appId, appSecret } = whatsappConfig()
    const query = new URLSearchParams({ input_token: token, access_token: `${appId}|${appSecret}` })
    const result = await this.request<{
      data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] }
    }>(null, 'GET', `/debug_token?${query}`)
    const scope = result.data?.granular_scopes?.find(
      (granted) => granted.scope === 'whatsapp_business_management'
    )
    return scope?.target_ids ?? []
  }

  /** The WABA's numbers. */
  async phoneNumbers(token: string, wabaId: string): Promise<PhoneNumberInfo[]> {
    const fields = 'display_phone_number,verified_name,platform_type'
    const result = await this.request<{ data?: PhoneNumberInfo[] }>(
      token,
      'GET',
      `/${encode(wabaId)}/phone_numbers?fields=${fields}`
    )
    return result.data ?? []
  }

  /** Puts the number on the Cloud API; the PIN becomes its two-step verification PIN. */
  async registerPhone(token: string, phoneNumberId: string, pin: string) {
    await this.request(token, 'POST', `/${encode(phoneNumberId)}/register`, {
      messaging_product: 'whatsapp',
      pin,
    })
  }

  /**
   * Subscribes the app to the WABA with our callback in place of the app's
   * (the app's own is another product's). Meta checks the URL with the
   * verify token before accepting it.
   */
  async subscribeApp(token: string, wabaId: string, callbackUrl: string, verifyToken: string) {
    await this.request(token, 'POST', `/${encode(wabaId)}/subscribed_apps`, {
      override_callback_uri: callbackUrl,
      verify_token: verifyToken,
    })
  }

  async unsubscribeApp(token: string, wabaId: string) {
    await this.request(token, 'DELETE', `/${encode(wabaId)}/subscribed_apps`)
  }

  async listTemplates(token: string, wabaId: string): Promise<TemplateInfo[]> {
    const fields = 'id,name,language,status,category,rejected_reason'
    const templates: TemplateInfo[] = []
    let path: string | null = `/${encode(wabaId)}/message_templates?fields=${fields}&limit=100`
    // A WABA rarely has more than a page; stop after a few anyway.
    for (let page = 0; path && page < 10; page++) {
      const result: Paged<TemplateInfo> = await this.request(token, 'GET', path)
      templates.push(...(result.data ?? []))
      path = result.paging?.next ? relativeGraphPath(result.paging.next) : null
    }
    return templates
  }

  async createTemplate(token: string, wabaId: string, body: Record<string, unknown>) {
    return await this.request<{ id: string; status: string; category: string }>(
      token,
      'POST',
      `/${encode(wabaId)}/message_templates`,
      body
    )
  }

  async sendTemplate(
    token: string,
    phoneNumberId: string,
    to: string,
    template: { name: string; language: string; components: Record<string, unknown>[] }
  ): Promise<SendResult> {
    return await this.send(token, phoneNumberId, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: template.name,
        language: { code: template.language },
        components: template.components,
      },
    })
  }

  /** Free text: only inside the 24-hour window the customer opened by writing to us. */
  async sendText(token: string, phoneNumberId: string, to: string, body: string) {
    return await this.send(token, phoneNumberId, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body },
    })
  }

  protected async send(token: string, phoneNumberId: string, body: Record<string, unknown>) {
    return await this.request<SendResult>(token, 'POST', `/${encode(phoneNumberId)}/messages`, body)
  }

  protected async request<T>(
    token: string | null,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const { graphVersion } = whatsappConfig()
    // Never log the query: the code exchange and debug_token carry the app secret.
    const logPath = path.split('?')[0]
    let response: Response
    try {
      response = await fetch(`${GRAPH}/${graphVersion}${path}`, {
        method,
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      logger.warn({ err: error, method, path: logPath }, 'WhatsApp (Meta) did not answer')
      throw new WhatsAppApiError('Meta did not answer', 0, null)
    }

    const answer = (await response.json().catch(() => null)) as (T & { error?: GraphError }) | null
    if (response.ok && answer && !answer.error) return answer

    const error = answer?.error
    const reason = error?.error_user_msg || error?.message || `HTTP ${response.status}`
    logger.warn(
      {
        status: response.status,
        method,
        path: logPath,
        code: error?.code,
        subcode: error?.error_subcode,
        reason: reason.slice(0, 300),
        details: error?.error_data?.details?.slice(0, 300),
        fbtraceId: error?.fbtrace_id,
      },
      'WhatsApp (Meta) refused a request'
    )
    throw new WhatsAppApiError(
      reason,
      response.status,
      error?.code ?? null,
      error?.error_subcode ?? null,
      error?.error_data?.details ?? null
    )
  }
}

type GraphError = {
  message?: string
  code?: number
  error_subcode?: number
  error_user_msg?: string
  error_data?: { details?: string }
  fbtrace_id?: string
}

function encode(id: string) {
  return encodeURIComponent(id)
}

/** Paging links are absolute and versioned; requests add the version themselves. */
function relativeGraphPath(next: string) {
  const url = new URL(next)
  if (url.host !== 'graph.facebook.com') return null
  return `${url.pathname.replace(/^\/v\d+\.\d+/, '')}${url.search}`
}
