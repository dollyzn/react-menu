import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import Order from '#models/order'
import PaymentService from '#services/payment_service'

type Payload = { orderId: string }

/**
 * Gives the money back for a cancelled paid order. Retried with backoff
 * (gateway down, network); after the last try it's left for a manual
 * refund in the gateway's panel.
 */
@inject()
export default class RefundOrder extends Job<Payload> {
  static options: JobOptions = {
    maxRetries: 8,
    retry: { backoff: exponentialBackoff({ baseDelay: '1m', maxDelay: '2h' }) },
  }

  constructor(private payments: PaymentService) {
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

  async failed(error: Error) {
    logger.error(
      { err: error, orderId: this.payload.orderId },
      'automatic refund gave up: refund it manually in the gateway'
    )
  }
}
