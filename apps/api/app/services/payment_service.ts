import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'
import AppException from '#exceptions/app_exception'
import OrderStatus from '#enums/order_status'
import Order from '#models/order'
import type Store from '#models/store'
import MercadoPagoClient, {
  checkoutUrl,
  isValidWebhookSignature,
} from '#payments/mercado_pago_client'
import OrderService from '#services/order_service'

type WebhookInput = {
  type: string | undefined
  dataId: string | undefined
  signature: string | undefined
  requestId: string | undefined
}

/** Mercado Pago Checkout Pro, with each store's own credentials. */
@inject()
export default class PaymentService {
  constructor(
    private client: MercadoPagoClient,
    private orders: OrderService
  ) {}

  /**
   * Creates the checkout for an order waiting for payment. If Mercado Pago is
   * unreachable the order is cancelled, so no unpayable order is left behind.
   */
  async startCheckout(order: Order, store: Store) {
    const accessToken = store.mercadoPagoAccessToken
    if (!accessToken) throw new AppException('Pagamento online indisponível nesta loja.', 422)
    await order.load('items', (items) => items.preload('addons'))

    try {
      const preference = await this.client.createPreference(accessToken, {
        externalReference: order.id,
        items: order.items.map((line) => ({
          title: [line.name, ...line.addons.map((addon) => `+ ${addon.name}`)].join(' '),
          quantity: line.quantity,
          unitPrice: line.total / line.quantity,
        })),
        payer: { name: order.customerName, phone: order.customerPhone },
        backUrl: `${env.get('FRONTEND_URL')}/pedido/${order.publicToken}`,
        notificationUrl: `${env.get('APP_URL')}/api/v1/webhooks/mercado-pago/${store.id}`,
        statementDescriptor: store.name,
      })
      order.mercadoPagoPreferenceId = preference.id
      await order.save()
      return checkoutUrl(preference.id, accessToken)
    } catch (error) {
      await this.orders.cancel(store.id, order.id)
      throw error
    }
  }

  /** Checkout link to resume payment from the tracking page. */
  checkoutUrlFor(order: Order, store: Store) {
    if (order.status !== OrderStatus.PENDING_PAYMENT) return null
    if (!order.mercadoPagoPreferenceId || !store.mercadoPagoAccessToken) return null
    return checkoutUrl(order.mercadoPagoPreferenceId, store.mercadoPagoAccessToken)
  }

  /**
   * Payment notifications. The body is never trusted: after checking the
   * signature, the payment is fetched from Mercado Pago with the store's token.
   */
  async handleWebhook(store: Store, input: WebhookInput) {
    if (!store.mercadoPagoAccessToken || !store.mercadoPagoWebhookSecret) {
      throw new AppException('Pagamento online não configurado', 404)
    }
    if (!input.dataId) throw new AppException('Notificação inválida', 400)
    if (
      !isValidWebhookSignature({
        signature: input.signature,
        requestId: input.requestId,
        dataId: input.dataId,
        secret: store.mercadoPagoWebhookSecret,
      })
    ) {
      throw new AppException('Assinatura inválida', 401, 'E_INVALID_SIGNATURE')
    }
    if (input.type !== 'payment') return

    const payment = await this.client.getPayment(store.mercadoPagoAccessToken, input.dataId)
    const order = payment.external_reference
      ? await Order.query().where({ id: payment.external_reference, storeId: store.id }).first()
      : null
    if (!order) {
      logger.warn({ paymentId: payment.id, storeId: store.id }, 'payment for an unknown order')
      return
    }

    if (payment.status === 'approved') {
      await this.orders.markPaid(order, { mercadoPagoPaymentId: String(payment.id) })
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await this.orders.markPaymentFailed(order)
    }
  }
}
