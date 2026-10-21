import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import OrderChannel from '#enums/order_channel'
import PaymentMethod from '#enums/payment_method'
import { ok, updated, created } from '#helpers/api_response'
import OrderService, { BUSINESS_TIMEZONE } from '#services/order_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { orderListValidator, posOrderValidator } from '#validators/order'

@inject()
export default class OrdersController {
  constructor(private orders: OrderService) {}

  /** Orders of a business day (today by default), optionally by status. */
  async index({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const qs = request.qs()
    const list = (value: unknown) => (value === undefined ? undefined : [value].flat())
    const filters = await orderListValidator.validate({
      ...qs,
      status: list(qs.status),
      channel: list(qs.channel),
      paymentMethod: list(qs.paymentMethod),
      sort: [qs.sort].flat()[0],
    })

    // History (paginated, any period) or the live board (one business day).
    if (filters.page) {
      const page = await this.orders.listHistory(storeId, filters)
      return ok(page.all(), page.getMeta())
    }
    return ok(
      await this.orders.list(storeId, {
        statuses: filters.status,
        date: filters.date
          ? DateTime.fromJSDate(filters.date, { zone: BUSINESS_TIMEZONE })
          : undefined,
      })
    )
  }

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    const order = await this.orders.find(storeId, orderId)
    return ok({
      ...order.serialize(),
      // Who changed each status: only the name leaves the API.
      history: order.history.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        createdAt: entry.createdAt.toISO(),
        user: entry.user ? { id: entry.user.id, name: entry.user.name } : null,
      })),
    })
  }

  /** Point of sale: paid at the counter, goes straight to the kitchen. */
  async store({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const input = await request.validateUsing(posOrderValidator)

    const order = await this.orders.create(
      storeId,
      {
        ...input,
        channel: OrderChannel.POS,
        paymentMethod: PaymentMethod.COUNTER,
        idempotencyKey: request.header('idempotency-key'),
      },
      auth.getUserOrFail()
    )

    return created(order, `Pedido #${order.number} criado`)
  }

  async complete({ params, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    const order = await this.orders.complete(storeId, orderId, auth.getUserOrFail())

    return updated(order, `Pedido #${order.number} entregue`)
  }

  async cancel({ params, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    const order = await this.orders.cancel(storeId, orderId, auth.getUserOrFail())

    return updated(order, `Pedido #${order.number} cancelado`)
  }

  /** Payment received at the counter before pickup. */
  async markPaid({ params, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    const order = await this.orders.find(storeId, orderId)
    await this.orders.markPaid(order, {}, auth.getUserOrFail())

    return updated(order, 'Pagamento registrado')
  }
}
