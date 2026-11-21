import { inject } from '@adonisjs/core'
import RefundOrder from '#jobs/refund_order'
import Store from '#models/store'
import type User from '#models/user'
import OrderService from '#services/order_service'
import PaymentService from '#services/payment_service'
import PointService from '#services/point_service'

/**
 * Cancelling an order with what follows it: a charge still waiting on the
 * card machine leaves it, and what a gateway took (online, the machine)
 * goes back (a job with retries). Money received at the counter is given
 * back by hand. The board, the partner area and the managers' answer to a
 * cancellation request all cancel through here.
 */
@inject()
export default class OrderCancellationService {
  constructor(
    private orders: OrderService,
    private payments: PaymentService,
    private point: PointService
  ) {}

  async cancel(
    storeId: string,
    orderId: string,
    actor: User,
    options: Parameters<OrderService['cancel']>[3] = {}
  ) {
    const order = await this.orders.cancel(storeId, orderId, actor, options)
    await this.point.cancelWaiting(order, await Store.findOrFail(storeId))
    if (await this.payments.hasRefundable(order)) {
      await RefundOrder.dispatchFor(order)
    }
    return order
  }
}
