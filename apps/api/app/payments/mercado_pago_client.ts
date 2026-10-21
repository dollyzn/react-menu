import { createHmac, timingSafeEqual } from 'node:crypto'
import AppException from '#exceptions/app_exception'

const API = 'https://api.mercadopago.com'

export type MercadoPagoPayment = {
  id: number
  status_detail?: string | null
  date_of_expiration?: string | null
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string }
  }
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

/** Body of POST /v1/payments (Checkout Transparente: Pix or tokenized card). */
export type PaymentInput = {
  transaction_amount: number
  description: string
  payment_method_id: string
  external_reference: string
  notification_url: string
  payer: {
    email: string
    first_name?: string
    identification?: { type: string; number: string }
  }
  token?: string
  installments?: number
  issuer_id?: string
  date_of_expiration?: string
  statement_descriptor?: string
}

/** Minimal Mercado Pago REST client. Swapped by a fake in tests. */
export default class MercadoPagoClient {
  /** Mercado Pago requires an idempotency key on payment writes. */
  async createPayment(
    accessToken: string,
    input: PaymentInput,
    idempotencyKey: string
  ): Promise<MercadoPagoPayment> {
    return await this.request(accessToken, 'POST', '/v1/payments', input, idempotencyKey)
  }

  /** Full refund. */
  async refundPayment(accessToken: string, paymentId: string, idempotencyKey: string) {
    await this.request(
      accessToken,
      'POST',
      `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
      {},
      idempotencyKey
    )
  }

  async getPayment(accessToken: string, paymentId: string): Promise<MercadoPagoPayment> {
    return await this.request(accessToken, 'GET', `/v1/payments/${encodeURIComponent(paymentId)}`)
  }

  private async request<T>(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string
  ) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey && { 'X-Idempotency-Key': idempotencyKey }),
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
