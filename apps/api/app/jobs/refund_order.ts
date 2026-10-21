import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { exponentialBackoff } from '@adonisjs/queue'
import AppJob from '#jobs/app_job'
import type { JobOptions } from '@adonisjs/queue/types'
import Order from '#models/order'
import PaymentService from '#services/payment_service'
import NotificationService from '#services/notification_service'
import StoreRole from '#enums/store_role'

type Payload = { orderId: string }

/**
 * Gives the money back for a cancelled paid order. Retried with backoff
 * (gateway down, network); after the last try it's left for a manual
 * refund in the gateway's panel.
 */
@inject()
export default class RefundOrder extends AppJob<Payload> {
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

  static async dispatchFor(order: Order) {
    await RefundOrder.dispatch({ orderId: order.id }).dedup({ id: order.id, ttl: '1d' })
  }

  async execute() {
    const order = await Order.query().where('id', this.payload.orderId).preload('store').first()
    if (!order) return
    await this.payments.refundCancelled(order, order.store)
  }

  /** Tells the store's managers (the order detail offers "Reembolsar agora"). */
  async failed(error: Error) {
    logger.error(
      { err: error, orderId: this.payload.orderId },
      'automatic refund gave up: refund it manually in the gateway'
    )
    const order = await Order.find(this.payload.orderId)
    if (!order) return
    await this.notifications.notifyStoreMembers(
      order.storeId,
      'order.refund_failed',
      { storeId: order.storeId, orderId: order.id, orderNumber: order.number },
      { roles: [StoreRole.MANAGER] }
    )
  }
}
