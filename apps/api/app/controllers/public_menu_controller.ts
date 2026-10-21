import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrderChannel from '#enums/order_channel'
import PaymentMethod from '#enums/payment_method'
import OrderStatus from '#enums/order_status'
import PaymentService from '#services/payment_service'
import { ok } from '#helpers/api_response'
import { publicOrder, publicOrderSummary } from '#orders/public_order'
import OrderService from '#services/order_service'
import PublicMenuService from '#services/public_menu_service'
import { lookupTokens, orderLookupValidator, publicOrderValidator } from '#validators/order'
import CustomerAccessService from '#services/customer_access_service'
import AppException from '#exceptions/app_exception'

/** Unauthenticated endpoints used by the customer-facing menu. */
@inject()
export default class PublicMenuController {
  constructor(
    private menus: PublicMenuService,
    private orders: OrderService,
    private payments: PaymentService,
    private access: CustomerAccessService
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

    await order.load('history')
    // History token for this device (see CustomerAccessService).
    const customerToken = await this.access.tokenFor(
      order.customerId,
      request.header('customer-token')
    )
    return ok({ ...publicOrder(order, store, checkoutUrl), customerToken })
  }

  /** Every order of the customer behind the `Customer-Token` header. */
  async myOrders({ params, request }: HttpContext) {
    const store = await this.menus.findBySlug(params.slug)
    const customer = await this.access.customerFor(store.id, request.header('customer-token'))
    if (!customer) {
      throw new AppException(
        'Este aparelho não está mais vinculado aos seus pedidos.',
        401,
        'E_CUSTOMER_TOKEN_INVALID'
      )
    }
    const orders = await this.orders.listForCustomer(store.id, customer.id)
    return ok({
      customer: { name: customer.name, phone: maskPhone(customer.phone) },
      orders: orders.map((order) => publicOrderSummary(order, store)),
    })
  }

  /** Live status of the orders this device placed (by their public tokens). */
  async lookupOrders({ request }: HttpContext) {
    const { tokens } = await request.validateUsing(orderLookupValidator)
    const orders = await this.orders.findManyByToken(lookupTokens(tokens))
    return ok(orders.map((order) => publicOrderSummary(order, order.store)))
  }

  async trackOrder({ params }: HttpContext) {
    const order = await this.orders.findByToken(params.token)
    return ok(publicOrder(order, order.store, this.payments.checkoutUrlFor(order, order.store)))
  }
}

/** "(11) •••••-4321": enough to recognize, not to reveal. */
function maskPhone(phone: string) {
  const national = phone.replace(/^55/, '')
  return `(${national.slice(0, 2)}) •••••-${national.slice(-4)}`
}
