import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrderChannel from '#enums/order_channel'
import PaymentMethod from '#enums/payment_method'
import OrderStatus from '#enums/order_status'
import PaymentService from '#services/payment_service'
import { ok } from '#helpers/api_response'
import { publicOrder } from '#orders/public_order'
import OrderService from '#services/order_service'
import PublicMenuService from '#services/public_menu_service'
import { publicOrderValidator } from '#validators/order'

/** Unauthenticated endpoints used by the customer-facing menu. */
@inject()
export default class PublicMenuController {
  constructor(
    private menus: PublicMenuService,
    private orders: OrderService,
    private payments: PaymentService
  ) {}

  /** `?preview=1` (staff screens such as the POS) is not counted as a customer visit. */
  async show({ params, request }: HttpContext) {
    const track = !request.input('preview')
    return ok(await this.menus.menu(params.slug, request.header('user-agent'), { track }))
  }

  async placeOrder({ params, request }: HttpContext) {
    const store = await this.menus.findBySlug(params.slug)
    const input = await request.validateUsing(publicOrderValidator)

    const order = await this.orders.create(store.id, {
      ...input,
      channel: OrderChannel.ONLINE,
      idempotencyKey: request.header('idempotency-key'),
    })
    // A retried request gets the same order: reuse its checkout, never pay twice.
    const checkoutUrl =
      input.paymentMethod === PaymentMethod.MERCADO_PAGO &&
      order.status === OrderStatus.PENDING_PAYMENT
        ? (this.payments.checkoutUrlFor(order, store) ??
          (await this.payments.startCheckout(order, store)))
        : null

    return ok(publicOrder(order, store, checkoutUrl))
  }

  async trackOrder({ params }: HttpContext) {
    const order = await this.orders.findByToken(params.token)
    return ok(publicOrder(order, order.store, this.payments.checkoutUrlFor(order, order.store)))
  }
}
