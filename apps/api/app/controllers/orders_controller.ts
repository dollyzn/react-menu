import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import OrderChannel from '#enums/order_channel'
import PaymentMethod from '#enums/payment_method'
import { ok, updated, created } from '#helpers/api_response'
import OrderService, { BUSINESS_TIMEZONE } from '#services/order_service'
import RefundOrder from '#jobs/refund_order'
import ExpireUnpaidOrder from '#jobs/expire_unpaid_order'
import PaymentService from '#services/payment_service'
import Store from '#models/store'
import type Order from '#models/order'
import OrderStatus from '#enums/order_status'
import StoreRole from '#enums/store_role'
import { storeExistValidator, uuidValidator } from '#validators/common'
import {
  addOrderItemsValidator,
  orderListValidator,
  payLaterListValidator,
  payLaterCustomersValidator,
  receivePayLaterValidator,
  payLaterValidator,
  posOrderValidator,
  receivePaymentValidator,
} from '#validators/order'

/**
 * The calendar day a `YYYY-MM-DD` query asked for, in the business timezone.
 * Vine parses it as midnight in the server's own timezone (UTC in
 * production), so it is read by its date parts, not converted (which made
 * "2026-11-10" the 9th in São Paulo).
 */
function businessDay(date: Date) {
  return DateTime.fromObject(
    { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
    { zone: BUSINESS_TIMEZONE }
  )
}

@inject()
export default class OrdersController {
  constructor(
    private orders: OrderService,
    private payments: PaymentService
  ) {}

  /** Orders of a business day (today by default), optionally by status. */
  async index({ params, request, bouncer }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const qs = request.qs()
    const list = (value: unknown) => (value === undefined ? undefined : [value].flat())
    const filters = await orderListValidator.validate({
      ...qs,
      status: list(qs.status),
      channel: list(qs.channel),
      paymentMethod: list(qs.paymentMethod),
      sort: [qs.sort].flat()[0],
      // A comma in the search ("Silva, Ana") arrives split (`comma: true`).
      customerName: qs.customerName === undefined ? undefined : [qs.customerName].flat().join(','),
    })

    // This endpoint serves two screens of the panel's "Pedidos" page:
    // - "Ao vivo" (no `page`): today's orders in the Na fila / Em preparo /
    //   Prontos columns. Every member needs it (attendants hand orders over).
    // - "Histórico" (`page`, filters, any period): sales and customer data,
    //   managers only. Asking "Ao vivo" for another day (`date`) is the same
    //   as looking at the history, so it is managers only too.
    const today = DateTime.now().setZone(BUSINESS_TIMEZONE).toISODate()
    const day = filters.date ? businessDay(filters.date) : undefined
    const otherDay = day !== undefined && day.toISODate() !== today
    if (filters.page || otherDay) {
      await bouncer.authorize('hasStoreRole', storeId, [StoreRole.MANAGER])
    }

    // History (paginated, any period) or the live board (one business day).
    if (filters.page) {
      // How many orders each filter option would show, when the table asks
      // (its first page; the next pages reuse them).
      const page = await this.orders.listHistory(storeId, filters)
      const facets = filters.facets ? await this.orders.historyFacets(storeId, filters) : undefined
      return ok(page.all(), { ...page.getMeta(), facets })
    }
    return ok(
      await this.orders.list(storeId, {
        statuses: filters.status,
        date: day,
      })
    )
  }

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    const order = await this.orders.find(storeId, orderId)
    return ok(await this.detail(order))
  }

  /** Managers: retries the refund of a cancelled paid order right away. */
  async refund({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    const order = await this.orders.find(storeId, orderId)
    await this.payments.refundNow(order, await Store.findOrFail(storeId))

    return updated(await this.detail(order), `Pedido #${order.number} reembolsado`)
  }

  /** Staff detail: status history with who did it, and the payment attempts. */
  private async detail(order: Order) {
    const [payments] = await Promise.all([
      this.payments.listFor(order),
      order.load('paidBy'),
      order.load('receipts', (receipts) => receipts.preload('receivedBy').orderBy('id')),
    ])
    return {
      // `paidBy` is replaced below by its name only.
      ...order.serialize(),
      payments: payments.map((payment) => ({
        method: payment.method,
        status: payment.status,
        statusDetail: payment.statusDetail,
        amount: payment.amount,
        fee: payment.fee,
        createdAt: payment.createdAt.toISO(),
      })),
      // Paid online and cancelled, but the money hasn't gone back yet.
      refundPending:
        order.status === OrderStatus.CANCELLED && (await this.payments.hasRefundable(order)),
      // Who received a counter payment: only the name leaves the API.
      paidBy: order.paidBy ? { id: order.paidBy.id, name: order.paidBy.name } : null,
      receipts: order.receipts.map((receipt) => ({
        amount: receipt.amount,
        fee: receipt.fee,
        paymentMethod: receipt.paymentMethod,
        counterMethod: receipt.counterMethod,
        receivedAt: receipt.receivedAt.toISO(),
        receivedBy: receipt.receivedBy
          ? { id: receipt.receivedBy.id, name: receipt.receivedBy.name }
          : null,
      })),
      // Who changed each status: only the name leaves the API.
      history: order.history.map((entry) => ({
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        createdAt: entry.createdAt.toISO(),
        user: entry.user ? { id: entry.user.id, name: entry.user.name } : null,
      })),
    }
  }

  /**
   * Point of sale: paid at the counter or later, goes straight to the
   * kitchen; charged on the card machine, it may wait for the approval
   * (`Store.pointKitchenAfterPayment`).
   */
  async store({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const input = await request.validateUsing(posOrderValidator)

    const order = await this.orders.create(
      storeId,
      {
        ...input,
        channel: OrderChannel.POS,
        paymentMethod: PaymentMethod.COUNTER,
        counterMethod: input.counterMethod,
        payOnMachine: input.payOnMachine,
        payLater: input.payLater,
        idempotencyKey: request.header('idempotency-key'),
      },
      auth.getUserOrFail()
    )
    // Waiting for the card machine: dropped by itself if nobody charges it.
    if (order.status === OrderStatus.PENDING_PAYMENT) await ExpireUnpaidOrder.scheduleFor(order)

    return created(order, `Pedido #${order.number} criado`)
  }

  async complete({ params, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)

    const order = await this.orders.complete(storeId, orderId, auth.getUserOrFail())

    return updated(order, `Pedido #${order.number} entregue`)
  }

  /**
   * Managers cancel any order (a paid one is refunded). Attendants only drop
   * one that is still waiting for its payment with nothing received (a POS
   * order whose card was refused on the machine).
   */
  async cancel({ params, auth, bouncer }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)
    const manager = await bouncer.allows('hasStoreRole', storeId, [StoreRole.MANAGER])

    const order = await this.orders.cancel(storeId, orderId, auth.getUserOrFail(), {
      onlyUnpaid: !manager,
    })
    // A charge still waiting on the card machine leaves it.
    const { default: PointService } = await import('#services/point_service')
    const point = await app.container.make(PointService)
    await point.cancelWaiting(order, await Store.findOrFail(storeId))
    // What the gateway took (online, the card machine) goes back (job with
    // retries); money received at the counter is given back by hand.
    if (await this.payments.hasRefundable(order)) {
      await RefundOrder.dispatchFor(order)
    }

    return updated(order, `Pedido #${order.number} cancelado`)
  }

  /** "Pagar depois" on an order already sent (front of house, like the POS). */
  async payLater({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)
    const input = await request.validateUsing(payLaterValidator)

    const order = await this.orders.markPayLater(storeId, orderId, input, auth.getUserOrFail())

    return updated(order, `Pedido #${order.number} fica para pagar depois`)
  }

  /**
   * The managers' "Pagar depois": open ones, any day, with who sent them
   * that way; search, sort and pages like the history.
   */
  async payLaterList({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const qs = request.qs()
    const filters = await payLaterListValidator.validate({
      ...qs,
      sort: [qs.sort].flat()[0],
      // A comma in the search ("Silva, Ana") arrives split (`comma: true`).
      customerName: qs.customerName === undefined ? undefined : [qs.customerName].flat().join(','),
    })
    const page = await this.orders.listPayLater(storeId, filters)
    return ok(
      page.all().map((order) => ({
        ...order.serialize(),
        payLaterBy: order.payLaterBy
          ? { id: order.payLaterBy.id, name: order.payLaterBy.name }
          : null,
      })),
      page.getMeta()
    )
  }

  /**
   * Open "pagar depois" by customer, with their orders (managers). Like the
   * order list beside it, it takes its own validator: the rows are customers
   * grouped in SQL, so there is no paginator to hand `ok()`.
   */
  async payLaterCustomers({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const qs = request.qs()
    const filters = await payLaterCustomersValidator.validate({
      ...qs,
      sort: [qs.sort].flat()[0],
      // A comma in the search arrives split (`comma: true`).
      search: qs.search === undefined ? undefined : [qs.search].flat().join(','),
    })
    const { data, meta } = await this.orders.listPayLaterCustomers(storeId, filters)
    return ok(
      data.map((customer) => ({
        ...customer,
        orders: customer.orders.map((order) => ({
          ...order.serialize(),
          payLaterBy: order.payLaterBy
            ? { id: order.payLaterBy.id, name: order.payLaterBy.name }
            : null,
        })),
      })),
      meta
    )
  }

  /** Several open "pagar depois" orders of one customer received at once (managers). */
  async receivePayLater({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const input = await request.validateUsing(receivePayLaterValidator)
    const result = await this.orders.receivePayLater(storeId, input, auth.getUserOrFail())
    return updated(
      result,
      result.orders === 1 ? 'Pagamento recebido' : `${result.orders} pedidos recebidos`
    )
  }

  /** The tab's count and who owes the most (managers). */
  async payLaterSummary({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return ok(await this.orders.payLaterSummary(storeId))
  }

  /** Items added to an order still in the queue, charged now or left to receive. */
  async addItems({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)
    const input = await request.validateUsing(addOrderItemsValidator)

    const order = await this.orders.addItems(
      storeId,
      orderId,
      { ...input, idempotencyKey: request.header('idempotency-key') },
      auth.getUserOrFail()
    )

    return updated(order, `Itens adicionados ao pedido #${order.number}`)
  }

  /** "Receber pagamento" at the counter: how it was paid, recorded with who received it. */
  async markPaid({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)
    const { method, amount } = await request.validateUsing(receivePaymentValidator)

    const order = await this.orders.find(storeId, orderId)
    await this.orders.markPaid(
      order,
      { counterMethod: method, expected: amount },
      auth.getUserOrFail()
    )

    return updated(order, 'Pagamento recebido')
  }
}
