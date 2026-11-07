import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import type { OrderLineInput } from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import OrderChannel from '#enums/order_channel'
import OrderStatus from '#enums/order_status'
import PaymentMethod, { isOnlinePayment } from '#enums/payment_method'
import Payment from '#models/payment'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import PaymentStatus from '#enums/payment_status'
import { normalizeBrazilianPhone } from '#helpers/phone'
import { broadcastOrderTracking, broadcastStoreEvent } from '#helpers/realtime'
import type Addon from '#models/addon'
import Customer from '#models/customer'
import Item from '#models/item'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import OrderItemAddon from '#models/order_item_addon'
import { optionPrice, pickPrice, type default as OptionGroup } from '#models/option_group'
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
      await this.inventory.assertStock(
        store,
        priced.map((line) => ({
          itemId: line.item.id,
          addonIds: line.addons.map((addon) => addon.id),
          quantity: line.quantity,
          name: line.item.name,
        })),
        trx
      )
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
            groupName: addon.groupName,
            unitPrice: addon.price,
          })),
          { client: trx }
        )
      }

      await this.history(created, null, OrderStatus.PENDING_PAYMENT, trx, actor)

      // Online payments wait for approval; counter orders go to the kitchen.
      if (!isOnlinePayment(input.paymentMethod)) {
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

  /**
   * Idempotent: Mercado Pago notifies the same approval more than once, often
   * at the same time (topics `order` and `payment`, plus the tracking page's
   * sync). The row lock makes the second call wait and find it paid, so the
   * stock is consumed and the staff notified once.
   */
  async markPaid(
    order: Order,
    meta: { mercadoPagoPaymentId?: string; paymentMethod?: PaymentMethod } = {},
    actor?: User
  ) {
    if (order.paymentStatus === PaymentStatus.PAID) return order
    let wasAwaitingPayment = false

    const changed = await db.transaction(async (trx) => {
      await this.lock(order, trx)
      if (order.paymentStatus === PaymentStatus.PAID) return false
      wasAwaitingPayment = order.status === OrderStatus.PENDING_PAYMENT
      order.paymentStatus = PaymentStatus.PAID
      if (meta.mercadoPagoPaymentId) order.mercadoPagoPaymentId = meta.mercadoPagoPaymentId
      // Paid on the card machine: refunded by itself if the order is cancelled.
      if (meta.paymentMethod) order.paymentMethod = meta.paymentMethod
      if (order.status === OrderStatus.PENDING_PAYMENT) {
        await this.enterKitchen(order, trx, actor)
      }
      await order.save()
      return true
    })

    if (changed) await this.afterChange(order, { notifyStaff: wasAwaitingPayment })
    return order
  }

  /** A new payment attempt started (e.g. a new Pix after a rejected card). */
  async markPaymentPending(order: Order) {
    if (order.paymentStatus === PaymentStatus.PENDING) return order
    if (order.paymentStatus === PaymentStatus.PAID) return order
    const changed = await db.transaction(async (trx) => {
      await this.lock(order, trx)
      // An approval that landed meanwhile wins.
      if (order.paymentStatus === PaymentStatus.PENDING) return false
      if (order.paymentStatus === PaymentStatus.PAID) return false
      order.paymentStatus = PaymentStatus.PENDING
      await order.save()
      return true
    })
    if (changed) await this.afterChange(order)
    return order
  }

  async markPaymentFailed(order: Order) {
    if (order.paymentStatus !== PaymentStatus.PENDING) return order
    const changed = await db.transaction(async (trx) => {
      await this.lock(order, trx)
      if (order.paymentStatus !== PaymentStatus.PENDING) return false
      order.paymentStatus = PaymentStatus.FAILED
      await order.save()
      return true
    })
    if (changed) await this.afterChange(order)
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
    const changed = await db.transaction(async (trx) => {
      await this.lock(order, trx)
      if (order.status === OrderStatus.COMPLETED) return false
      await this.transition(order, OrderStatus.COMPLETED, trx, actor)
      // Paid at the counter on hand-over, unless the card machine is still
      // charging it: then the machine's answer says whether it was paid
      // (marking it paid here would make that approval look like a second
      // payment and refund it).
      if (
        order.paymentMethod === PaymentMethod.COUNTER &&
        !(await this.chargeOnMachine(order, trx))
      ) {
        order.paymentStatus = PaymentStatus.PAID
      }
      await order.save()
      return true
    })
    if (changed) await this.afterChange(order)
    return order
  }

  /** A card machine charge of the order still waiting for the customer. */
  private async chargeOnMachine(order: Order, trx: TransactionClientContract) {
    const waiting = await Payment.query({ client: trx })
      .where({
        orderId: order.id,
        method: PaymentMethod.POINT,
        status: PaymentAttemptStatus.PENDING,
      })
      .first()
    return Boolean(waiting)
  }

  async cancel(storeId: string, orderId: string, actor?: User) {
    const order = await this.find(storeId, orderId)
    // Idempotent: cancelling twice (a double tap, the expiry job meanwhile)
    // must not reverse the stock twice.
    if (order.status === OrderStatus.CANCELLED) return order
    const changed = await db.transaction(async (trx) => {
      await this.lock(order, trx)
      if (order.status === OrderStatus.CANCELLED) return false
      await this.transition(order, OrderStatus.CANCELLED, trx, actor)
      await this.inventory.reverseForOrder(order, trx)
      await order.save()
      return true
    })
    if (changed) await this.afterChange(order)
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

  /** Paginated order history with filters (staff "Histórico"). */
  async listHistory(
    storeId: string,
    filters: {
      status?: OrderStatus[]
      channel?: OrderChannel[]
      paymentMethod?: PaymentMethod[]
      createdAt?: string
      customerName?: string
      sort?: 'createdAt:desc' | 'createdAt:asc' | 'total:desc' | 'total:asc'
      page?: number
      perPage?: number
    }
  ) {
    const [from, to] = (filters.createdAt ?? '~').split('~')
    const search = filters.customerName?.trim()
    const digits = search?.replace(/\D/g, '') ?? ''
    const [column, direction] = (filters.sort ?? 'createdAt:desc').split(':') as [
      'createdAt' | 'total',
      'asc' | 'desc',
    ]

    return await Order.query()
      .where({ storeId })
      .if(from, (query) => query.where('business_date', '>=', from))
      .if(to, (query) => query.where('business_date', '<=', to))
      .if(filters.status?.length, (query) => query.whereIn('status', filters.status!))
      .if(filters.channel?.length, (query) => query.whereIn('channel', filters.channel!))
      .if(filters.paymentMethod?.length, (query) =>
        query.whereIn('payment_method', filters.paymentMethod!)
      )
      .if(search, (query) =>
        query.where((match) => {
          match.whereILike('customer_name', `%${search}%`)
          // "#12" or "12": the order number; 8+ digits: part of the phone.
          if (/^#?\d{1,5}$/.test(search!)) match.orWhere('number', Number(digits))
          if (digits.length >= 4) match.orWhere('customer_phone', 'like', `%${digits}%`)
        })
      )
      .preload('items', (items) => items.preload('addons').orderBy('id'))
      .orderBy(column === 'total' ? 'total' : 'created_at', direction)
      .paginate(filters.page ?? 1, filters.perPage ?? 20)
  }

  async find(storeId: string, orderId: string) {
    const order = await Order.query()
      .where({ id: orderId, storeId })
      .preload('items', (items) => items.preload('addons').orderBy('id'))
      .preload('history', (history) => history.preload('user').orderBy('id'))
      .first()
    if (!order) throw new AppException('Pedido não encontrado', 404)
    return order
  }

  async findByToken(publicToken: string) {
    const order = await Order.query()
      .where({ publicToken })
      .preload('items', (items) => items.preload('addons').orderBy('id'))
      .preload('history')
      .preload('store')
      .first()
    if (!order) throw new AppException('Pedido não encontrado', 404)
    return order
  }

  /** Orders of the given public tokens (a device's own history), newest first. */
  async findManyByToken(publicTokens: string[]) {
    if (publicTokens.length === 0) return []
    return await Order.query()
      .whereIn('publicToken', publicTokens)
      .preload('items', (items) => items.orderBy('id'))
      .preload('store')
      .orderBy('createdAt', 'desc')
  }

  /** A customer's latest orders in one store, newest first. */
  async listForCustomer(storeId: string, customerId: string, limit = 30) {
    return await Order.query()
      .where({ storeId, customerId })
      .preload('items', (items) => items.orderBy('id'))
      .orderBy('createdAt', 'desc')
      .limit(limit)
  }

  private assertCanOrder(store: Store, input: CreateOrderInput) {
    if (input.lines.length === 0) {
      throw new AppException('Adicione pelo menos um item ao pedido.', 422)
    }
    if (input.channel === OrderChannel.ONLINE && !store.isOpen) {
      const opensAt = store.availabilityAt().opensAt
      throw new AppException(
        opensAt
          ? `A loja está fechada agora. Abre ${opensAt.setLocale('pt-BR').toFormat("cccc 'às' HH:mm")}.`
          : 'A loja não está aceitando pedidos agora.',
        409,
        'E_STORE_CLOSED'
      )
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
      // In the item's order, like the menu: the legacy fallback picks the first
      // group, and the add-ons are saved (and printed) in this order.
      .preload('optionGroups', (groups) =>
        groups
          .orderBy('item_option_groups.order', 'asc')
          .preload('options', (options) => options.orderBy('option_group_addons.order', 'asc'))
      )
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

      // Each pick knows its group: the group sets the price and the label
      // ("Recheio extra: Carne"), and the same add-on may sit in two groups.
      // A group that allows repeats keeps each pick ("Queijo" twice).
      const picks = new Map<string, { addon: Addon; group: OptionGroup | null }>()
      const pick = (addon: Addon, group: OptionGroup | null) => {
        const key = `${group?.id ?? ''}:${addon.id}`
        if (!group?.allowRepeat) return picks.set(key, { addon, group })
        let n = 0
        while (picks.has(`${key}#${n}`)) n++
        return picks.set(`${key}#${n}`, { addon, group })
      }
      for (const choice of line.choices ?? []) {
        const group = item.optionGroups.find((candidate) => candidate.id === choice.groupId)
        const addon = group?.options.find((option) => option.id === choice.addonId)
        if (!group || !addon) throw new AppException(`Adicional inválido para ${item.name}.`, 422)
        pick(addon, group)
      }
      const pickedIn = (group: OptionGroup) =>
        [...picks.values()].filter((entry) => entry.group?.id === group.id).length
      for (const addonId of new Set(line.addonIds ?? [])) {
        // Bags saved before `choices` send group options here too, as the
        // groups counted them then: the first group (in the item's order)
        // that offers it and still has room, else a free add-on.
        const offering = item.optionGroups.filter((candidate) =>
          candidate.options.some((option) => option.id === addonId)
        )
        const group =
          offering.find((candidate) => pickedIn(candidate) < candidate.maxChoices) ??
          (item.addons.some((candidate) => candidate.id === addonId) ? undefined : offering[0])
        if (group) {
          pick(
            group.options.find((option) => option.id === addonId)!,
            group
          )
          continue
        }
        const free = item.addons.find((candidate) => candidate.id === addonId)
        if (!free) throw new AppException(`Adicional inválido para ${item.name}.`, 422)
        pick(free, null)
      }

      // Choice groups: each one's minimum and maximum.
      for (const group of item.optionGroups) {
        const picked = pickedIn(group)
        if (picked < group.minChoices || picked > group.maxChoices) {
          const want =
            group.minChoices === group.maxChoices
              ? `${group.minChoices}`
              : picked < group.minChoices
                ? `pelo menos ${group.minChoices}`
                : `até ${group.maxChoices}`
          throw new AppException(
            `${item.name}: escolha ${want} em "${group.name}".`,
            422,
            'E_CHOICE_REQUIRED'
          )
        }
      }

      // Groups priced by pick order: the nth pick (in the order chosen) costs
      // the nth price, whichever option it is.
      const priceOf = new Map<{ addon: Addon; group: OptionGroup | null }, number>()
      const pickCount = new Map<string, number>()
      for (const entry of picks.values()) {
        if (!entry.group) continue
        const index = pickCount.get(entry.group.id) ?? 0
        pickCount.set(entry.group.id, index + 1)
        priceOf.set(entry, pickPrice(entry.group, index) ?? optionPrice(entry.addon))
      }

      // Saved (and printed) like the menu shows them: groups in the item's
      // order, each one's options in order, then the free add-ons.
      const rank = ({ addon, group }: { addon: Addon; group: OptionGroup | null }) =>
        group
          ? item.optionGroups.indexOf(group) * 100 + group.options.indexOf(addon)
          : Number.MAX_SAFE_INTEGER
      const addons = [...picks.values()]
        .sort((a, b) => rank(a) - rank(b))
        .map((entry) => {
          const { addon, group } = entry
          if (!addon.isAvailable || unavailable.addons.has(addon.id)) {
            throw new AppException(
              `${addon.name} está indisponível no momento.`,
              422,
              'E_UNAVAILABLE'
            )
          }
          return {
            id: addon.id,
            name: addon.name,
            price: priceOf.get(entry) ?? addon.price,
            groupName: group?.name ?? null,
          }
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

  /**
   * Locks the order's row for this transaction and reloads it, so changes to
   * the same order from different places wait for each other and the checks
   * after this run on the latest state (preloaded relations are kept).
   */
  private async lock(order: Order, trx: TransactionClientContract) {
    await trx.from('orders').where('id', order.id).forUpdate().select('id').first()
    await order.useTransaction(trx).refresh()
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
      // A plain query: on a model query the sum's alias never reached $extras
      // (every notification said "0 itens").
      const items = await db
        .from('order_items')
        .where('order_id', order.id)
        .sum('quantity as total')
        .first()
      await this.notifications.notifyStoreMembers(order.storeId, 'order.received', {
        storeId: order.storeId,
        orderNumber: order.number,
        customerName: order.customerName,
        itemsCount: Number(items?.total ?? 0),
      })
    }
  }
}
