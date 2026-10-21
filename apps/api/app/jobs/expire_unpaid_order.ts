import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import { DateTime } from 'luxon'
import OrderStatus from '#enums/order_status'
import PaymentStatus from '#enums/payment_status'
import Order from '#models/order'
import OrderService from '#services/order_service'
import PaymentService from '#services/payment_service'

/** Online orders nobody paid are cancelled after this (a Pix lasts 30 min). */
export const UNPAID_ORDER_TTL = '40m'
/** Never keep an order waiting longer than this, even with a card in review. */
const MAX_WAIT_HOURS = 6

type Payload = { orderId: string }

/**
 * Cancels an online order that was never paid, so it doesn't linger on the
 * board. A payment still in progress (a Pix generated late, a card in
 * review) postpones it instead.
 */
@inject()
export default class ExpireUnpaidOrder extends Job<Payload> {
  static options: JobOptions = {
    maxRetries: 5,
    retry: { backoff: exponentialBackoff({ baseDelay: '30s', maxDelay: '10m' }) },
  }

  constructor(
    private orders: OrderService,
    private payments: PaymentService
  ) {
    super()
  }

  /** Scheduled once per order when it is placed. */
  static async scheduleFor(order: Order) {
    await ExpireUnpaidOrder.dispatch({ orderId: order.id })
      .in(UNPAID_ORDER_TTL)
      .dedup({ id: order.id, ttl: '2h' })
  }

  async execute() {
    const order = await Order.find(this.payload.orderId)
    if (!order || order.status !== OrderStatus.PENDING_PAYMENT) return
    if (order.paymentStatus === PaymentStatus.PAID) return

    const until = await this.payments.payableUntil(order)
    const tooOld = order.createdAt.plus({ hours: MAX_WAIT_HOURS }) < DateTime.now()
    if (until && !tooOld) {
      const wait = Math.max(60, Math.ceil(until.diffNow('seconds').seconds) + 5 * 60)
      await ExpireUnpaidOrder.dispatch(this.payload).in(`${wait}s`)
      return
    }

    await this.orders.cancel(order.storeId, order.id)
    logger.info({ orderId: order.id }, 'unpaid online order cancelled')
  }
}
