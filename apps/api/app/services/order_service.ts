import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import type { OrderLineInput } from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import OrderChannel from '#enums/order_channel'
import OrderStatus from '#enums/order_status'
import PaymentMethod from '#enums/payment_method'
import PaymentStatus from '#enums/payment_status'
import StoreStatus from '#enums/store_status'
import { normalizeBrazilianPhone } from '#helpers/phone'
import { broadcastOrderTracking, broadcastStoreEvent } from '#helpers/realtime'
import Customer from '#models/customer'
import Item from '#models/item'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import OrderItemAddon from '#models/order_item_addon'
import OrderStatusHistory from '#models/order_status_history'
import Store from '#models/store'
import type User from '#models/user'
import { ACTIVE_STATUSES, canTransition } from '#orders/order_state'
import InventoryService from '#services/inventory_service'
import NotificationService from '#services/notification_service'

/** Business day boundaries follow the restaurant, not UTC. */
export const BUSINESS_TIMEZONE = 'America/Sao_Paulo'

const MAX_QUANTITY_PER_LINE = 50
const money = (value: number) => Math.round(value * 100) / 100

export type CreateOrderInput = {
  channel: OrderChannel
  customer: { name: string; phone?: string | null }
  paymentMethod: PaymentMethod
  lines: OrderLineInput[]
  notes?: string | null
  /** From the Idempotency-Key header: a retry returns the same order. */
  idempotencyKey?: string | null
}

@inject()
export default class OrderService {
  constructor(
    private inventory: InventoryService,
    private notifications: NotificationService
  ) {}

  /**
   * Creates an order from what the customer chose. Prices, availability and
   * add-on validity always come from the current menu, never from the client.
   */
  async create(storeId: string, input: CreateOrderInput, actor?: User) {
    const key = input.idempotencyKey || null
    const result = await db.transaction(async (trx) => {
      // Locks the store row: serializes daily numbering for concurrent orders,
      // and makes the idempotency check below race-free.
      const store = await Store.query({ client: trx })
        .where('id', storeId)
        .forUpdate()
        .firstOrFail()

      if (key) {
        const existing = await Order.query({ client: trx })
          .where({ storeId, idempotencyKey: key })
          .first()
        if (existing) return { order: existing, replayed: true }
      }
      this.assertCanOrder(store, input)

      const priced = await this.priceLines(store, input.lines, trx)
      const subtotal = money(priced.reduce((sum, line) => sum + line.total, 0))

      const phone = input.customer.phone ? normalizeBrazilianPhone(input.customer.phone) : null
      if (input.customer.phone && !phone) {
        throw new AppException('Telefone inválido. Use DDD + número.', 422, 'E_INVALID_PHONE')
      }
      if (input.channel === OrderChannel.ONLINE && !phone) {
        throw new AppException(
          'Informe um telefone para acompanhar o pedido.',
          422,
          'E_INVALID_PHONE'
        )
      }
      const customer = phone
        ? await Customer.updateOrCreate(
            { storeId, phone },
            { name: input.customer.name },
            { client: trx }
          )
        : null

      const businessDate = DateTime.now().setZone(BUSINESS_TIMEZONE).startOf('day')
      const last = await Order.query({ client: trx })
        .where({ storeId })
        .where('business_date', businessDate.toISODate()!)
        .max('number as max')
        .first()

      const created = await Order.create(
        {
          storeId,
          number: Number(last?.$extras.max ?? 0) + 1,
          businessDate,
          customerId: customer?.id ?? null,
          customerName: input.customer.name,
          customerPhone: phone,
          channel: input.channel,
          status: OrderStatus.PENDING_PAYMENT,
          paymentMethod: input.paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          subtotal,
          total: subtotal,
          notes: input.notes || null,
          createdById: actor?.id ?? null,
          idempotencyKey: key,
        },
        { client: trx }
      )

      for (const line of priced) {
        const orderItem = await OrderItem.create(
          {
            orderId: created.id,
            itemId: line.item.id,
            name: line.item.name,
            unitPrice: line.item.price,
            quantity: line.quantity,
            preparedQuantity: 0,
            requiresPreparation: line.item.category.requiresPreparation,
            notes: line.notes,
            total: line.total,
          },
          { client: trx }
        )
        await OrderItemAddon.createMany(
          line.addons.map((addon) => ({
            orderItemId: orderItem.id,
            addonId: addon.id,
            name: addon.name,
            unitPrice: addon.price,
          })),
          { client: trx }
        )
      }

      await this.history(created, null, OrderStatus.PENDING_PAYMENT, trx, actor)

      // Mercado Pago orders wait for payment; everything else goes to the kitchen.
      if (input.paymentMethod !== PaymentMethod.MERCADO_PAGO) {
        await this.enterKitchen(created, trx, actor)
      }
      return { order: created, replayed: false }
    })

    // A retry of an order that already exists: no new events or notifications.
    if (!result.replayed) {
      await this.afterChange(result.order, {
        type: 'order.created',
        notifyStaff: result.order.status !== OrderStatus.PENDING_PAYMENT,
      })
    }
    return await this.find(storeId, result.order.id)
  }

  /** Idempotent: webhooks may deliver the same payment more than once. */
  async markPaid(order: Order, meta: { mercadoPagoPaymentId?: string } = {}, actor?: User) {
    if (order.paymentStatus === PaymentStatus.PAID) return order
    const wasAwaitingPayment = order.status === OrderStatus.PENDING_PAYMENT

    await db.transaction(async (trx) => {
      order.useTransaction(trx)
      order.paymentStatus = PaymentStatus.PAID
      if (meta.mercadoPagoPaymentId) order.mercadoPagoPaymentId = meta.mercadoPagoPaymentId
      if (order.status === OrderStatus.PENDING_PAYMENT) {
        await this.enterKitchen(order, trx, actor)
      }
      await order.save()
    })

    await this.afterChange(order, { notifyStaff: wasAwaitingPayment })
    return order
  }

  async markPaymentFailed(order: Order) {
    if (order.paymentStatus !== PaymentStatus.PENDING) return order
    order.paymentStatus = PaymentStatus.FAILED
    await order.save()
    await this.afterChange(order)
    return order
  }

  /**
   * Kitchen progress. `quantity` may be negative to undo a mistaken tap.
   * Order status follows the lines: some done → preparing, all done → ready.
   */
  async prepareUnits(storeId: string, units: { lineId: number; quantity: number }[], actor?: User) {
    const changed = await db.transaction(async (trx) => {
      const lines = await OrderItem.query({ client: trx })
        .whereIn(
          'id',
          units.map((unit) => unit.lineId)
        )
        .preload('order')
        .forUpdate()

      const orders = new Map<string, Order>()
      for (const unit of units) {
        const line = lines.find((candidate) => candidate.id === unit.lineId)
        if (!line || line.order.storeId !== storeId) {
          throw new AppException('Item do pedido não encontrado', 404)
        }
        if (!ACTIVE_STATUSES.includes(line.order.status as (typeof ACTIVE_STATUSES)[number])) {
          throw new AppException(`O pedido #${line.order.number} não está em produção`, 409)
        }
        line.preparedQuantity = Math.min(
          line.quantity,
          Math.max(0, line.preparedQuantity + unit.quantity)
        )
        await line.useTransaction(trx).save()
        orders.set(line.order.id, line.order)
      }

      for (const order of orders.values()) {
        await this.syncKitchenStatus(order, trx, actor)
      }
      return [...orders.values()]
    })

    for (const order of changed) await this.afterChange(order)
  }

  /** Handed over at the counter. Counter payments are settled here. */
  async complete(storeId: string, orderId: string, actor?: User) {
    const order = await this.find(storeId, orderId)
    // Idempotent: a retried "Entregar" after a lost response is a success.
    if (order.status === OrderStatus.COMPLETED) return order
    await db.transaction(async (trx) => {
      await this.transition(order, OrderStatus.COMPLETED, trx, actor)
      if (order.paymentMethod === PaymentMethod.COUNTER) {
        order.paymentStatus = PaymentStatus.PAID
      }
      await order.save()
    })
    await this.afterChange(order)
    return order
  }

  async cancel(storeId: string, orderId: string, actor?: User) {
    const order = await this.find(storeId, orderId)
    // Idempotent: cancelling twice must not reverse the stock twice.
    if (order.status === OrderStatus.CANCELLED) return order
    await db.transaction(async (trx) => {
      await this.transition(order, OrderStatus.CANCELLED, trx, actor)
      await this.inventory.reverseForOrder(order, trx)
      await order.save()
    })
    if (
      order.paymentStatus === PaymentStatus.PAID &&
      order.paymentMethod === PaymentMethod.MERCADO_PAGO
    ) {
      logger.warn({ orderId: order.id }, 'cancelled a paid Mercado Pago order: refund it manually')
    }
    await this.afterChange(order)
    return order
  }

  async list(storeId: string, filters: { statuses?: OrderStatus[]; date?: DateTime } = {}) {
    const date = (filters.date ?? DateTime.now().setZone(BUSINESS_TIMEZONE)).toISODate()!
    return await Order.query()
      .where({ storeId })
      .where('business_date', date)
      .if(filters.statuses?.length, (query) => query.whereIn('status', filters.statuses!))
      .preload('items', (items) => items.preload('addons').orderBy('id'))
      .orderBy('createdAt', 'asc')
  }

  async find(storeId: string, orderId: string) {
    const order = await Order.query()
      .where({ id: orderId, storeId })
      .preload('items', (items) => items.preload('addons').orderBy('id'))
      .first()
    if (!order) throw new AppException('Pedido não encontrado', 404)
    return order
  }

  async findByToken(publicToken: string) {
    const order = await Order.query()
      .where({ publicToken })
      .preload('items', (items) => items.preload('addons').orderBy('id'))
      .preload('store')
      .first()
    if (!order) throw new AppException('Pedido não encontrado', 404)
    return order
  }

  private assertCanOrder(store: Store, input: CreateOrderInput) {
    if (input.lines.length === 0) {
      throw new AppException('Adicione pelo menos um item ao pedido.', 422)
    }
    if (input.channel === OrderChannel.ONLINE && store.status !== StoreStatus.OPEN) {
      throw new AppException('A loja não está aceitando pedidos agora.', 409, 'E_STORE_CLOSED')
    }
    if (input.paymentMethod === PaymentMethod.MERCADO_PAGO && !store.mercadoPagoEnabled) {
      throw new AppException('Pagamento online indisponível nesta loja.', 422)
    }
    if (
      input.paymentMethod === PaymentMethod.COUNTER &&
      input.channel === OrderChannel.ONLINE &&
      !store.counterPaymentEnabled
    ) {
      throw new AppException('Esta loja só aceita pagamento online.', 422)
    }
  }

  private async priceLines(store: Store, lines: OrderLineInput[], trx: TransactionClientContract) {
    const itemIds = [...new Set(lines.map((line) => line.itemId))]
    const items = await Item.query({ client: trx })
      .whereIn('id', itemIds)
      .whereHas('category', (category) => category.where('store_id', store.id))
      .preload('category')
      .preload('addons')
    const unavailable = await this.inventory.unavailable(store, trx)

    return lines.map((line) => {
      const item = items.find((candidate) => candidate.id === line.itemId)
      if (!item) throw new AppException('Um dos itens não existe mais no cardápio.', 422)
      if (!item.isAvailable || unavailable.items.has(item.id)) {
        throw new AppException(`${item.name} está indisponível no momento.`, 422, 'E_UNAVAILABLE')
      }
      if (
        !Number.isInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > MAX_QUANTITY_PER_LINE
      ) {
        throw new AppException(`Quantidade inválida para ${item.name}.`, 422)
      }

      const addons = [...new Set(line.addonIds ?? [])].map((addonId) => {
        const addon = item.addons.find((candidate) => candidate.id === addonId)
        if (!addon) throw new AppException(`Adicional inválido para ${item.name}.`, 422)
        if (!addon.isAvailable || unavailable.addons.has(addon.id)) {
          throw new AppException(
            `${addon.name} está indisponível no momento.`,
            422,
            'E_UNAVAILABLE'
          )
        }
        return addon
      })

      const unitTotal = item.price + addons.reduce((sum, addon) => sum + addon.price, 0)
      return {
        item,
        addons,
        quantity: line.quantity,
        notes: line.notes?.trim() || null,
        total: money(unitTotal * line.quantity),
      }
    })
  }

  /** Received: stock is consumed; orders with nothing to cook are ready at once. */
  private async enterKitchen(order: Order, trx: TransactionClientContract, actor?: User) {
    await this.transition(order, OrderStatus.RECEIVED, trx, actor)
    await this.inventory.consumeForOrder(order, trx)
    await order.useTransaction(trx).save()
    await this.syncKitchenStatus(order, trx, actor)
  }

  private async syncKitchenStatus(order: Order, trx: TransactionClientContract, actor?: User) {
    const lines = await OrderItem.query({ client: trx }).where({
      orderId: order.id,
      requiresPreparation: true,
    })
    const done = lines.every((line) => line.preparedQuantity >= line.quantity)
    const started = lines.some((line) => line.preparedQuantity > 0)
    const target = done ? OrderStatus.READY : started ? OrderStatus.PREPARING : OrderStatus.RECEIVED

    if (target !== order.status && canTransition(order.status, target)) {
      await this.transition(order, target, trx, actor)
      await order.useTransaction(trx).save()
    }
  }

  private async transition(
    order: Order,
    to: OrderStatus,
    trx: TransactionClientContract,
    actor?: User
  ) {
    const from = order.status
    if (from === to) return
    if (!canTransition(from, to)) {
      throw new AppException(`Não é possível mudar o pedido de ${from} para ${to}.`, 409)
    }
    order.status = to
    if (to === OrderStatus.READY) order.readyAt = DateTime.now()
    if (to === OrderStatus.COMPLETED) order.completedAt = DateTime.now()
    await this.history(order, from, to, trx, actor)
  }

  private async history(
    order: Order,
    from: OrderStatus | null,
    to: OrderStatus,
    trx: TransactionClientContract,
    actor?: User
  ) {
    await OrderStatusHistory.create(
      { orderId: order.id, fromStatus: from, toStatus: to, userId: actor?.id ?? null },
      { client: trx }
    )
  }

  /** After commit: realtime hints for staff and the customer, and staff notifications. */
  private async afterChange(
    order: Order,
    options: { type?: 'order.created' | 'order.updated'; notifyStaff?: boolean } = {}
  ) {
    const type = options.type ?? 'order.updated'
    broadcastStoreEvent({ type, storeId: order.storeId, orderId: order.id, status: order.status })
    broadcastOrderTracking(order.publicToken, {
      type: 'order.updated',
      status: order.status,
      paymentStatus: order.paymentStatus,
    })

    // Staff are notified once an online order actually needs work (POS
    // orders were entered by the staff themselves).
    if (options.notifyStaff && order.channel === OrderChannel.ONLINE) {
      const items = await OrderItem.query()
        .where('orderId', order.id)
        .sum('quantity as total')
        .first()
      await this.notifications.notifyStoreMembers(order.storeId, 'order.received', {
        storeId: order.storeId,
        orderNumber: order.number,
        customerName: order.customerName,
        itemsCount: Number(items?.$extras.total ?? 0),
      })
    }
  }
}
