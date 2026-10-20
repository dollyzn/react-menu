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
    const filters = await orderListValidator.validate({
      status: qs.status === undefined ? undefined : [qs.status].flat(),
      date: qs.date,
    })

    const orders = await this.orders.list(storeId, {
      statuses: filters.status,
      date: filters.date
        ? DateTime.fromJSDate(filters.date, { zone: BUSINESS_TIMEZONE })
        : undefined,
    })

    return ok(orders)
  }

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    return ok(await this.orders.find(storeId, orderId))
  }

  /** Point of sale: paid at the counter, goes straight to the kitchen. */
  async store({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const input = await request.validateUsing(posOrderValidator)

    const order = await this.orders.create(
      storeId,
      { ...input, channel: OrderChannel.POS, paymentMethod: PaymentMethod.COUNTER },
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
