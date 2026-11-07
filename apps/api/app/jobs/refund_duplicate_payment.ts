import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { exponentialBackoff } from '@adonisjs/queue'
import AppJob from '#jobs/app_job'
import type { JobOptions } from '@adonisjs/queue/types'
import Payment from '#models/payment'
import PaymentService from '#services/payment_service'
import NotificationService from '#services/notification_service'
import StoreRole from '#enums/store_role'

type Payload = { paymentId: string }

/**
 * An order paid twice (a card machine charge approved after it was paid in
 * cash, a Pix that landed after the card…): the extra payment goes back.
 */
@inject()
export default class RefundDuplicatePayment extends AppJob<Payload> {
  static options: JobOptions = {
    maxRetries: 8,
    retry: { backoff: exponentialBackoff({ baseDelay: '1m', maxDelay: '2h' }) },
  }

  constructor(
    private payments: PaymentService,
    private notifications: NotificationService
  ) {
    super()
  }

  static async dispatchFor(payment: Payment) {
    await RefundDuplicatePayment.dispatch({ paymentId: payment.id }).dedup({
      id: payment.id,
      ttl: '1d',
    })
  }

  async execute() {
    const payment = await Payment.query()
      .where('id', this.payload.paymentId)
      .preload('order', (order) => order.preload('store'))
      .first()
    if (!payment) return
    await this.payments.refundDuplicate(payment, payment.order.store)
  }

  /** Tells the managers: the extra payment must be refunded in Mercado Pago by hand. */
  async failed(error: Error) {
    logger.error(
      { err: error, paymentId: this.payload.paymentId },
      'duplicate payment refund gave up: refund it manually in the gateway'
    )
    const payment = await Payment.query()
      .where('id', this.payload.paymentId)
      .preload('order')
      .first()
    if (!payment) return
    await this.notifications.notifyStoreMembers(
      payment.storeId,
      'order.refund_failed',
      { storeId: payment.storeId, orderId: payment.orderId, orderNumber: payment.order.number },
      { roles: [StoreRole.MANAGER] }
    )
  }
}
