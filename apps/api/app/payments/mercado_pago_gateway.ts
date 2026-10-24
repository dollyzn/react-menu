import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import PaymentMethod from '#enums/payment_method'
import type Store from '#models/store'
import type MercadoPagoClient from '#payments/mercado_pago_client'
import type {
  MercadoPagoOrder,
  MercadoPagoPayment,
  OrderInput,
} from '#payments/mercado_pago_client'
import type { CardRequest, GatewayPayment, PaymentGateway, PixRequest } from '#payments/gateway'

/** Orders API ids ("ORD01…"); attempts made before it have numeric Payments API ids. */
const isOrderId = (id: string) => id.startsWith('ORD')

const money = (value: number) => value.toFixed(2)

function orderStatus(order: MercadoPagoOrder): PaymentAttemptStatus {
  switch (order.status) {
    case 'processed':
      return PaymentAttemptStatus.APPROVED
    case 'refunded':
    case 'charged_back':
      return PaymentAttemptStatus.REFUNDED
    case 'failed':
      return order.status_detail === 'expired'
        ? PaymentAttemptStatus.EXPIRED
        : PaymentAttemptStatus.REJECTED
    case 'canceled':
    case 'expired':
      return PaymentAttemptStatus.EXPIRED
    // created, processing, action_required (waiting_transfer, pending_challenge…)
    default:
      return PaymentAttemptStatus.PENDING
  }
}

function fromOrder(order: MercadoPagoOrder, fallbackExpiry?: DateTime): GatewayPayment {
  const transaction = order.transactions?.payments?.[0]
  const qrCode = transaction?.payment_method?.qr_code
  return {
    gatewayPaymentId: order.id,
    status: orderStatus(order),
    // The transaction says why a card failed (rejected_by_issuer…); the order only "failed".
    statusDetail: transaction?.status_detail ?? order.status_detail ?? null,
    orderId: order.external_reference ?? null,
    pix: qrCode
      ? {
          qrCode,
          ticketUrl: transaction?.payment_method?.ticket_url ?? null,
          expiresAt: transaction?.date_of_expiration
            ? DateTime.fromISO(transaction.date_of_expiration)
            : (fallbackExpiry ?? null),
        }
      : undefined,
    challengeUrl:
      transaction?.status_detail === 'pending_challenge'
        ? (transaction.payment_method?.transaction_security?.url ?? null)
        : null,
  }
}

const LEGACY_STATUS: Record<MercadoPagoPayment['status'], PaymentAttemptStatus> = {
  approved: PaymentAttemptStatus.APPROVED,
  authorized: PaymentAttemptStatus.APPROVED,
  pending: PaymentAttemptStatus.PENDING,
  in_process: PaymentAttemptStatus.PENDING,
  rejected: PaymentAttemptStatus.REJECTED,
  cancelled: PaymentAttemptStatus.EXPIRED,
  refunded: PaymentAttemptStatus.REFUNDED,
  charged_back: PaymentAttemptStatus.REFUNDED,
}

function fromLegacyPayment(payment: MercadoPagoPayment): GatewayPayment {
  return {
    gatewayPaymentId: String(payment.id),
    status: LEGACY_STATUS[payment.status] ?? PaymentAttemptStatus.PENDING,
    statusDetail: payment.status_detail ?? null,
    orderId: payment.external_reference,
  }
}

/**
 * Mercado Pago Checkout Transparente on the Orders API: one order per
 * attempt (Pix QR code, or a card tokenized in the browser by the Card
 * Payment Brick, with 3-D Secure when Mercado Pago asks for it; card needs
 * the store's public key). Attempts created
 * before it (Payments API) are still read and refunded there.
 */
export default class MercadoPagoGateway implements PaymentGateway {
  readonly name = 'mercado_pago'
  readonly methods: PaymentMethod[]
  private accessToken: string

  constructor(
    private client: MercadoPagoClient,
    store: Store
  ) {
    if (!store.mercadoPagoAccessToken) {
      throw new AppException('Pagamento online indisponível nesta loja.', 422)
    }
    this.accessToken = store.mercadoPagoAccessToken
    this.methods = store.mercadoPagoPublicKey
      ? [PaymentMethod.PIX, PaymentMethod.CARD]
      : [PaymentMethod.PIX]
  }

  async createPix(request: PixRequest) {
    const minutes = Math.max(30, Math.ceil(request.expiresAt.diffNow('minutes').minutes))
    const order = await this.create(request, {
      amount: money(request.amount),
      // ISO 8601 duration; Mercado Pago accepts 30 minutes to 30 days.
      expiration_time: `PT${minutes}M`,
      payment_method: { id: 'pix', type: 'bank_transfer' },
    })
    return fromOrder(order, request.expiresAt)
  }

  async createCard(request: CardRequest) {
    const order = await this.create(
      request,
      {
        amount: money(request.amount),
        payment_method: {
          id: request.card.paymentMethodId,
          type: request.card.paymentTypeId === 'debit_card' ? 'debit_card' : 'credit_card',
          token: request.card.token,
          installments: request.card.installments,
          statement_descriptor: request.statementDescriptor.slice(0, 22),
        },
      },
      request.card.identification,
      // 3-D Secure when Mercado Pago sees a risk; the chargeback then falls on the card network.
      {
        online: {
          transaction_security: { validation: 'on_fraud_risk', liability_shift: 'required' },
        },
      }
    )
    return fromOrder(order)
  }

  async fetch(gatewayPaymentId: string) {
    return isOrderId(gatewayPaymentId)
      ? fromOrder(await this.client.getOrder(this.accessToken, gatewayPaymentId))
      : fromLegacyPayment(await this.client.getPayment(this.accessToken, gatewayPaymentId))
  }

  async refund(gatewayPaymentId: string, idempotencyKey: string) {
    if (isOrderId(gatewayPaymentId)) {
      await this.client.refundOrder(this.accessToken, gatewayPaymentId, idempotencyKey)
    } else {
      await this.client.refundPayment(this.accessToken, gatewayPaymentId, idempotencyKey)
    }
  }

  private async create(
    request: PixRequest | CardRequest,
    payment: OrderInput['transactions']['payments'][number],
    identification?: { type: string; number: string },
    config?: OrderInput['config']
  ) {
    return await this.client.createOrder(
      this.accessToken,
      {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: money(request.amount),
        external_reference: request.orderId,
        description: request.description,
        config,
        payer: { email: request.payer.email, first_name: request.payer.name, identification },
        transactions: { payments: [payment] },
      },
      request.idempotencyKey
    )
  }
}
