import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrderChannel from '#enums/order_channel'
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
    private orders: OrderService
  ) {}

  /** `?preview=1` (staff screens such as the POS) is not counted as a customer visit. */
  async show({ params, request }: HttpContext) {
    const track = !request.input('preview')
    return ok(await this.menus.menu(params.slug, request.header('user-agent'), { track }))
  }

  async placeOrder({ params, request }: HttpContext) {
    const store = await this.menus.findBySlug(params.slug)
    const input = await request.validateUsing(publicOrderValidator)

    const order = await this.orders.create(store.id, { ...input, channel: OrderChannel.ONLINE })

    return ok(publicOrder(order, store))
  }

  async trackOrder({ params }: HttpContext) {
    const order = await this.orders.findByToken(params.token)
    return ok(publicOrder(order, order.store))
  }
}
