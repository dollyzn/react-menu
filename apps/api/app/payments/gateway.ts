import type { DateTime } from 'luxon'
import type PaymentAttemptStatus from '#enums/payment_attempt_status'
import type PaymentMethod from '#enums/payment_method'

type BaseRequest = {
  orderId: string
  amount: number
  description: string
  payer: { name: string; email: string }
  statementDescriptor: string
  /** Same key on a retry: the gateway must not charge twice. */
  idempotencyKey: string
}

export type PixRequest = BaseRequest & { expiresAt: DateTime }

export type CardRequest = BaseRequest & {
  card: {
    token: string
    installments: number
    paymentMethodId: string
    /** credit_card or debit_card (the card form knows); credit when missing. */
    paymentTypeId?: string
    issuerId?: string
    identification?: { type: string; number: string }
  }
}

export type GatewayPayment = {
  gatewayPaymentId: string
  status: PaymentAttemptStatus
  statusDetail: string | null
  /** Order the payment refers to (external reference), when the gateway knows. */
  orderId: string | null
  pix?: { qrCode: string; ticketUrl: string | null; expiresAt: DateTime | null }
  /** 3-D Secure: the payer must confirm with the bank on this page (status pending). */
  challengeUrl?: string | null
}

/**
 * A payment provider for one store (its own credentials). Each checkout
 * method (Pix, card) is a capability a gateway may or may not offer.
 */
export interface PaymentGateway {
  readonly name: string
  /** Online methods this gateway can take for the store. */
  readonly methods: PaymentMethod[]
  createPix(request: PixRequest): Promise<GatewayPayment>
  createCard(request: CardRequest): Promise<GatewayPayment>
  /** Current state, straight from the provider (never trust webhook bodies). */
  fetch(gatewayPaymentId: string): Promise<GatewayPayment>
  refund(gatewayPaymentId: string, idempotencyKey: string): Promise<void>
}
