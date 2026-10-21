import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrderChannel from '#enums/order_channel'
import PaymentService from '#services/payment_service'
import { ok } from '#helpers/api_response'
import { publicOrder, publicOrderSummary } from '#orders/public_order'
import OrderService from '#services/order_service'
import PublicMenuService from '#services/public_menu_service'
import { lookupTokens, publicOrderValidator, publicPaymentValidator } from '#validators/order'
import type Order from '#models/order'
import type Store from '#models/store'
import CustomerAccessService from '#services/customer_access_service'
import AppException from '#exceptions/app_exception'
import OrderStatus from '#enums/order_status'
import ExpireUnpaidOrder from '#jobs/expire_unpaid_order'

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

    if (!this.payments.checkoutMethods(store).includes(input.paymentMethod)) {
      throw new AppException('Esta forma de pagamento não está disponível.', 422)
    }

    // Online orders are paid next, on their tracking page (POST .../payments).
    const order = await this.orders.create(store.id, {
      ...input,
      channel: OrderChannel.ONLINE,
      idempotencyKey: request.header('idempotency-key'),
    })

    // Not paid in time: cancelled automatically (scheduled once per order).
    if (order.status === OrderStatus.PENDING_PAYMENT) await ExpireUnpaidOrder.scheduleFor(order)

    await order.load('history')
    // History token for this device (see CustomerAccessService).
    const customerToken = await this.access.tokenFor(
      order.customerId,
      request.header('customer-token')
    )
    return ok({
      ...publicOrder(order, store, await this.checkoutState(order, store)),
      customerToken,
    })
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
    // The query parser splits commas (`comma: true`): "a,b" arrives as a list.
    const tokens = [request.qs().tokens]
      .flat()
      .flatMap((value) => (typeof value === 'string' ? value.split(',') : []))
    const orders = await this.orders.findManyByToken(lookupTokens(tokens))
    return ok(orders.map((order) => publicOrderSummary(order, order.store)))
  }

  async trackOrder({ params }: HttpContext) {
    const order = await this.orders.findByToken(params.token)
    return ok(publicOrder(order, order.store, await this.checkoutState(order, order.store)))
  }

  /** Pays an order waiting for payment: Pix QR code or a tokenized card. */
  async payOrder({ params, request }: HttpContext) {
    const order = await this.orders.findByToken(params.token)
    const input = await request.validateUsing(publicPaymentValidator)
    const key = request.header('idempotency-key')

    await this.payments.pay(order, order.store, {
      ...input,
      // Scoped to the order: the same browser key never pays another order.
      idempotencyKey: key ? `${order.id}:${key}` : undefined,
    })

    const fresh = await this.orders.findByToken(params.token)
    return ok(publicOrder(fresh, fresh.store, await this.checkoutState(fresh, fresh.store)))
  }

  /** Development fake gateway: approves the pending Pix. */
  async simulatePayment({ params }: HttpContext) {
    const order = await this.orders.findByToken(params.token)
    await this.payments.simulateApproval(order)

    const fresh = await this.orders.findByToken(params.token)
    return ok(publicOrder(fresh, fresh.store, await this.checkoutState(fresh, fresh.store)))
  }

  private async checkoutState(order: Order, store: Store) {
    return {
      payment: await this.payments.latestFor(order),
      methods: this.payments.onlineMethods(store),
    }
  }
}

/** "(11) •••••-4321": enough to recognize, not to reveal. */
function maskPhone(phone: string) {
  const national = phone.replace(/^55/, '')
  return `(${national.slice(0, 2)}) •••••-${national.slice(-4)}`
}
