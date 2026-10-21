import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import PaymentMethod from '#enums/payment_method'
import type Store from '#models/store'
import type MercadoPagoClient from '#payments/mercado_pago_client'
import type { MercadoPagoPayment, PaymentInput } from '#payments/mercado_pago_client'
import type { CardRequest, GatewayPayment, PaymentGateway, PixRequest } from '#payments/gateway'

const STATUS: Record<MercadoPagoPayment['status'], PaymentAttemptStatus> = {
  approved: PaymentAttemptStatus.APPROVED,
  authorized: PaymentAttemptStatus.APPROVED,
  pending: PaymentAttemptStatus.PENDING,
  in_process: PaymentAttemptStatus.PENDING,
  rejected: PaymentAttemptStatus.REJECTED,
  cancelled: PaymentAttemptStatus.EXPIRED,
  refunded: PaymentAttemptStatus.REFUNDED,
  charged_back: PaymentAttemptStatus.REFUNDED,
}

function toGatewayPayment(payment: MercadoPagoPayment): GatewayPayment {
  const pix = payment.point_of_interaction?.transaction_data
  return {
    gatewayPaymentId: String(payment.id),
    status: STATUS[payment.status] ?? PaymentAttemptStatus.PENDING,
    statusDetail: payment.status_detail ?? null,
    orderId: payment.external_reference,
    pix: pix?.qr_code
      ? {
          qrCode: pix.qr_code,
          ticketUrl: pix.ticket_url ?? null,
          expiresAt: payment.date_of_expiration
            ? DateTime.fromISO(payment.date_of_expiration)
            : null,
        }
      : undefined,
  }
}

/**
 * Mercado Pago Checkout Transparente (Payments API): Pix QR codes and cards
 * tokenized in the browser by the Card Payment Brick. Card needs the
 * store's public key.
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
    return await this.create(request, {
      payment_method_id: 'pix',
      // Mercado Pago's format: 2026-10-21T15:30:00.000-03:00
      date_of_expiration: request.expiresAt.toISO()!,
    })
  }

  async createCard(request: CardRequest) {
    return await this.create(request, {
      payment_method_id: request.card.paymentMethodId,
      token: request.card.token,
      installments: request.card.installments,
      issuer_id: request.card.issuerId,
      statement_descriptor: request.statementDescriptor.slice(0, 22),
      payer: {
        email: request.payer.email,
        first_name: request.payer.name,
        identification: request.card.identification,
      },
    })
  }

  async fetch(gatewayPaymentId: string) {
    return toGatewayPayment(await this.client.getPayment(this.accessToken, gatewayPaymentId))
  }

  async refund(gatewayPaymentId: string, idempotencyKey: string) {
    await this.client.refundPayment(this.accessToken, gatewayPaymentId, idempotencyKey)
  }

  private async create(
    request: PixRequest | CardRequest,
    specific: Partial<PaymentInput> & { payment_method_id: string }
  ) {
    const payment = await this.client.createPayment(
      this.accessToken,
      {
        transaction_amount: request.amount,
        description: request.description,
        external_reference: request.orderId,
        notification_url: request.notificationUrl,
        payer: { email: request.payer.email, first_name: request.payer.name },
        ...specific,
      },
      request.idempotencyKey
    )
    return toGatewayPayment(payment)
  }
}
