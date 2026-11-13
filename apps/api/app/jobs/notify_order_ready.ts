import { inject } from '@adonisjs/core'
import { exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import { DateTime } from 'luxon'
import AppJob from '#jobs/app_job'
import OrderStatus from '#enums/order_status'
import Order from '#models/order'
import PushService from '#services/push_service'

type Payload = { orderId: string }

/**
 * "Seu pedido está pronto" to the customer's browsers that asked for it on
 * the tracking page. Once per time the order became ready
 * (`ready_notified_at`), so a retry or a second dispatch never repeats it.
 */
@inject()
export default class NotifyOrderReady extends AppJob<Payload> {
  static options: JobOptions = {
    maxRetries: 3,
    retry: { backoff: exponentialBackoff({ baseDelay: '5s', maxDelay: '1m' }) },
  }

  constructor(private push: PushService) {
    super()
  }

  static async dispatchFor(order: Order) {
    const key = `${order.id}:${order.readyAt?.toMillis() ?? 0}`
    await NotifyOrderReady.dispatch({ orderId: order.id }).dedup({ id: key, ttl: '1h' })
  }

  async execute() {
    const order = await Order.query().where('id', this.payload.orderId).preload('store').first()
    if (!order || order.status !== OrderStatus.READY || !order.readyAt) return
    if (order.readyNotifiedAt && order.readyNotifiedAt >= order.readyAt) return

    await this.push.sendToOrder(order.id, {
      title: `Pedido #${order.number} pronto!`,
      body: `Pode retirar no balcão da ${order.store.name}.`,
      url: `/pedido/${order.publicToken}`,
      tag: `order-ready-${order.publicToken}`,
    })
    order.readyNotifiedAt = DateTime.now()
    await order.save()
  }

  /** Only logged by the base class' notice: a missed "pronto" isn't worth waking the admins. */
  protected notifyFailureByEmail = false
}
