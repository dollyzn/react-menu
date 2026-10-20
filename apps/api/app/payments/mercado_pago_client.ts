import { createHmac, timingSafeEqual } from 'node:crypto'
import AppException from '#exceptions/app_exception'

const API = 'https://api.mercadopago.com'

export type PreferenceInput = {
  externalReference: string
  items: { title: string; quantity: number; unitPrice: number }[]
  payer: { name: string; phone?: string | null }
  backUrl: string
  notificationUrl: string
  statementDescriptor: string
}

export type MercadoPagoPayment = {
  id: number
  status:
    | 'approved'
    | 'pending'
    | 'in_process'
    | 'authorized'
    | 'rejected'
    | 'cancelled'
    | 'refunded'
    | 'charged_back'
  external_reference: string | null
}

/** Test credentials (TEST-…) use the sandbox checkout. */
export const isTestToken = (accessToken: string) => accessToken.startsWith('TEST-')

export function checkoutUrl(preferenceId: string, accessToken: string) {
  const host = isTestToken(accessToken) ? 'sandbox.mercadopago.com.br' : 'www.mercadopago.com.br'
  return `https://${host}/checkout/v1/redirect?pref_id=${preferenceId}`
}

/**
 * Validates Mercado Pago's `x-signature` header (HMAC-SHA256 over
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" with the webhook secret).
 */
export function isValidWebhookSignature(input: {
  signature: string | undefined
  requestId: string | undefined
  dataId: string
  secret: string
}) {
  if (!input.signature) return false
  const parts = Object.fromEntries(
    input.signature.split(',').map((part) => part.trim().split('=') as [string, string])
  )
  if (!parts.ts || !parts.v1) return false

  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId ?? ''};ts:${parts.ts};`
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex')
  const given = Buffer.from(parts.v1, 'hex')
  const wanted = Buffer.from(expected, 'hex')
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/** Minimal Mercado Pago REST client (Checkout Pro). Swapped by a fake in tests. */
export default class MercadoPagoClient {
  async createPreference(accessToken: string, input: PreferenceInput): Promise<{ id: string }> {
    return await this.request(accessToken, 'POST', '/checkout/preferences', {
      external_reference: input.externalReference,
      items: input.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        currency_id: 'BRL',
      })),
      payer: { name: input.payer.name },
      back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
      auto_return: 'approved',
      notification_url: input.notificationUrl,
      statement_descriptor: input.statementDescriptor.slice(0, 22),
    })
  }

  async getPayment(accessToken: string, paymentId: string): Promise<MercadoPagoPayment> {
    return await this.request(accessToken, 'GET', `/v1/payments/${encodeURIComponent(paymentId)}`)
  }

  private async request<T>(accessToken: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      throw new AppException(
        'Não foi possível falar com o Mercado Pago. Tente novamente.',
        502,
        'E_PAYMENT_PROVIDER'
      )
    }
    return (await response.json()) as T
  }
}
