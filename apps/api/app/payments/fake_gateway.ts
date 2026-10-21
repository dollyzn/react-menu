import AppException from '#exceptions/app_exception'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import PaymentMethod from '#enums/payment_method'
import Payment from '#models/payment'
import type { GatewayPayment, PaymentGateway, PixRequest } from '#payments/gateway'

/**
 * Development only (PAYMENTS_FAKE_GATEWAY=true, never in production): a Pix
 * that never leaves the machine, so the whole checkout can be tried without
 * Mercado Pago credentials. "Simular pagamento" on the order page approves it.
 */
export default class FakeGateway implements PaymentGateway {
  readonly name = 'fake'
  readonly methods = [PaymentMethod.PIX]

  async createPix(request: PixRequest): Promise<GatewayPayment> {
    return {
      gatewayPaymentId: `fake-${request.idempotencyKey}`,
      status: PaymentAttemptStatus.PENDING,
      statusDetail: 'pending_waiting_transfer',
      orderId: request.orderId,
      pix: {
        // Not a valid BR Code: banking apps will refuse it, on purpose.
        qrCode: `00020126FAKE-PIX-${request.orderId}-${request.amount.toFixed(2)}`,
        ticketUrl: null,
        expiresAt: request.expiresAt,
      },
    }
  }

  async createCard(): Promise<GatewayPayment> {
    throw new AppException('Cartão não está disponível no modo de teste.', 422)
  }

  async fetch(gatewayPaymentId: string): Promise<GatewayPayment> {
    const payment = await Payment.query()
      .where({ gateway: this.name, gatewayPaymentId })
      .firstOrFail()
    return {
      gatewayPaymentId,
      status: payment.status,
      statusDetail: payment.statusDetail,
      orderId: payment.orderId,
    }
  }

  async refund() {}
}
