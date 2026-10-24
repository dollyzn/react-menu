import { createHmac, timingSafeEqual } from 'node:crypto'
import AppException from '#exceptions/app_exception'

const API = 'https://api.mercadopago.com'

/** Orders API: an order holds one payment transaction (Pix or card). */
export type MercadoPagoOrder = {
  id: string
  /** created, processing, action_required, processed, failed, canceled, expired, refunded, charged_back */
  status: string
  /** e.g. accredited, waiting_transfer, failed, expired, refunded */
  status_detail?: string | null
  external_reference?: string | null
  transactions?: {
    payments?: {
      id?: string
      status?: string
      /** Why it failed: rejected_by_issuer, insufficient_amount, bad_filled_card_data… */
      status_detail?: string | null
      date_of_expiration?: string | null
      payment_method?: {
        id?: string
        type?: string
        qr_code?: string
        ticket_url?: string
        /** 3-D Secure: `url` is the challenge page while the detail is pending_challenge. */
        transaction_security?: { url?: string | null; status?: string | null }
      }
    }[]
  }
}

/** Body of POST /v1/orders (Checkout Transparente, automatic processing). */
export type OrderInput = {
  type: 'online'
  processing_mode: 'automatic'
  /** Decimal strings ("15.00"), like every amount in the Orders API. */
  total_amount: string
  external_reference: string
  description: string
  /** 3-D Secure: `on_fraud_risk` lets Mercado Pago ask for the bank's challenge. */
  config?: {
    online: {
      transaction_security: { validation: 'on_fraud_risk' | 'never'; liability_shift?: 'required' }
    }
  }
  payer: {
    email: string
    first_name?: string
    identification?: { type: string; number: string }
  }
  transactions: {
    payments: {
      amount: string
      /** ISO 8601 duration (Pix: 30 minutes to 30 days). */
      expiration_time?: string
      payment_method: {
        id: string
        type: 'bank_transfer' | 'credit_card' | 'debit_card'
        token?: string
        installments?: number
        statement_descriptor?: string
      }
    }[]
  }
}

/** Payments API (before the Orders API): only read and refunded, for older attempts. */
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
 * Validates Mercado Pago's `x-signature` header: HMAC-SHA256 with the
 * webhook secret over "id:<data.id>;request-id:<x-request-id>;ts:<ts>;",
 * leaving out a part whose value is missing (as the official SDK does).
 * Older docs asked for alphanumeric ids in lowercase and the SDK sends them
 * as received, so both spellings are accepted (both need the secret).
 */
export function isValidWebhookSignature(input: {
  signature: string | undefined
  requestId: string | undefined
  dataId: string
  secret: string
}) {
  if (!input.signature) return false
  const parts = Object.fromEntries(
    input.signature.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=')
      return [key.toLowerCase(), value.join('=')]
    })
  )
  if (!parts.ts || !parts.v1) return false

  const given = Buffer.from(parts.v1, 'hex')
  return [...new Set([input.dataId, input.dataId.toLowerCase()])].some((dataId) => {
    const manifest = [
      dataId && `id:${dataId}`,
      input.requestId && `request-id:${input.requestId}`,
      `ts:${parts.ts}`,
    ]
      .filter(Boolean)
      .join(';')
    const wanted = Buffer.from(
      createHmac('sha256', input.secret).update(`${manifest};`).digest('hex'),
      'hex'
    )
    return given.length === wanted.length && timingSafeEqual(given, wanted)
  })
}

/** Minimal Mercado Pago REST client. Swapped by a fake in tests. */
export default class MercadoPagoClient {
  /**
   * Creates and processes the order. A card the issuer refuses answers 402
   * with the order (its payment failed): that is a result, not an error.
   */
  async createOrder(
    accessToken: string,
    input: OrderInput,
    idempotencyKey: string
  ): Promise<MercadoPagoOrder> {
    return await this.request(accessToken, 'POST', '/v1/orders', input, idempotencyKey, [402])
  }

  async getOrder(accessToken: string, orderId: string): Promise<MercadoPagoOrder> {
    return await this.request(accessToken, 'GET', `/v1/orders/${encodeURIComponent(orderId)}`)
  }

  /** Full refund (no amount). */
  async refundOrder(accessToken: string, orderId: string, idempotencyKey: string) {
    await this.request(
      accessToken,
      'POST',
      `/v1/orders/${encodeURIComponent(orderId)}/refund`,
      undefined,
      idempotencyKey
    )
  }

  async getPayment(accessToken: string, paymentId: string): Promise<MercadoPagoPayment> {
    return await this.request(accessToken, 'GET', `/v1/payments/${encodeURIComponent(paymentId)}`)
  }

  /** Full refund of a Payments API payment. */
  async refundPayment(accessToken: string, paymentId: string, idempotencyKey: string) {
    await this.request(
      accessToken,
      'POST',
      `/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
      {},
      idempotencyKey
    )
  }

  private async request<T>(
    accessToken: string,
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
    /** Non-2xx statuses whose body is still the resource. */
    resultStatuses: number[] = []
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
    if (resultStatuses.includes(response.status)) {
      const result = (await response.json().catch(() => null)) as T | null
      if (result && typeof result === 'object' && 'id' in result) return result
    }
    if (!response.ok) {
      throw new AppException(
        'Não foi possível falar com o Mercado Pago. Tente novamente.',
        502,
        'E_PAYMENT_PROVIDER'
      )
    }
    return (await response.json().catch(() => ({}))) as T
  }
}
