import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type {
  CreatePartnerOrderInput,
  PartnerOrder,
  PartnerOrderStage,
} from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import CancelRequestStatus from '#enums/cancel_request_status'
import OrderChannel from '#enums/order_channel'
import OrderStatus from '#enums/order_status'
import PaymentMethod from '#enums/payment_method'
import PaymentStatus from '#enums/payment_status'
import StoreRole from '#enums/store_role'
import { broadcastPartnerEvent, broadcastStoreEvent } from '#helpers/realtime'
import ExpireUnpaidOrder from '#jobs/expire_unpaid_order'
import Order from '#models/order'
import OrderCancelRequest from '#models/order_cancel_request'
import Payment from '#models/payment'
import Store from '#models/store'
import type StorePartner from '#models/store_partner'
import type User from '#models/user'
import { partnerCancelOption } from '#partners/cancel_policy'
import NotificationService from '#services/notification_service'
import OrderCancellationService from '#services/order_cancellation_service'
import OrderService from '#services/order_service'
import PartnerService, { sellsItem } from '#services/partner_service'
import PointService from '#services/point_service'
import PublicMenuService from '#services/public_menu_service'

/** Where a partner's order is, for the partner's board. */
export function partnerStage(order: {
  status: OrderStatus
  partnerDeliveredAt: DateTime | null
}): PartnerOrderStage {
  switch (order.status) {
    case OrderStatus.PENDING_PAYMENT:
      return 'awaiting_payment'
    case OrderStatus.RECEIVED:
    case OrderStatus.PREPARING:
      return 'in_kitchen'
    case OrderStatus.READY:
      return 'ready'
    case OrderStatus.COMPLETED:
      return order.partnerDeliveredAt ? 'delivered' : 'with_partner'
    case OrderStatus.CANCELLED:
      return 'cancelled'
  }
}

/**
 * The partner area (ADR 0024): what a signed-in partner sells and follows.
 * Every query is scoped to the store and the partner.
 */
@inject()
export default class PartnerOrderService {
  constructor(
    private partners: PartnerService,
    private orders: OrderService,
    private cancellation: OrderCancellationService,
    private menus: PublicMenuService,
    private point: PointService,
    private notifications: NotificationService
  ) {}

  async context(storeId: string, partner: StorePartner) {
    const store = await Store.findOrFail(storeId)
    const [terminal] = await this.point.enabledTerminals(store, { partnerId: partner.id })
    return {
      store: { id: store.id, name: store.name, photoUrl: store.photoUrl, isOpen: store.isOpen },
      partner: {
        id: partner.id,
        name: partner.name,
        commission: {
          type: partner.commissionType,
          value: partner.commissionValue,
          since: partner.commissionUpdatedAt.toISO()!,
        },
        cancelPolicy: partner.cancelPolicy,
        paused: Boolean(partner.pausedAt),
      },
      terminal: terminal ? { terminalId: terminal.terminalId, name: terminal.name } : null,
      point: {
        available: this.point.available(store),
        paymentTypes: store.pointPaymentTypes,
        maxInstallments: store.pointMaxInstallments,
      },
    }
  }

  /** The store's menu, with only what the partner may sell. */
  async menu(storeId: string, partner: StorePartner) {
    const catalog = await this.partners.catalog(partner)
    return await this.menus.menuOf(storeId, (item) => sellsItem(catalog, item))
  }

  async create(
    storeId: string,
    partner: StorePartner,
    input: CreatePartnerOrderInput,
    actor: User,
    idempotencyKey: string | null
  ) {
    const order = await this.orders.create(
      storeId,
      {
        channel: OrderChannel.PARTNER,
        // Charged on the partner's machine (an action on the order, like the POS).
        paymentMethod: PaymentMethod.COUNTER,
        customer: input.customer,
        lines: input.lines,
        notes: input.notes,
        partnerId: partner.id,
        idempotencyKey,
      },
      actor
    )
    // Dropped by itself if nobody charges it.
    if (order.status === OrderStatus.PENDING_PAYMENT) await ExpireUnpaidOrder.scheduleFor(order)
    return await this.show(storeId, partner, order.id)
  }

  async list(storeId: string, partner: StorePartner, filters: { date?: DateTime } = {}) {
    const orders = await this.orders.listForPartner(storeId, partner.id, filters)
    return await this.present(partner, orders)
  }

  async show(storeId: string, partner: StorePartner, orderId: string) {
    const order = await this.orders.findForPartner(storeId, partner.id, orderId)
    const [presented] = await this.present(partner, [order])
    return presented
  }

  /**
   * Cancels within the partner's window (an unpaid order always). Past
   * it: 409 `E_CANCEL_REQUIRES_APPROVAL`, the partner asks a manager.
   */
  async cancel(storeId: string, partner: StorePartner, orderId: string, actor: User) {
    // 404 for anyone else's order.
    await this.orders.findForPartner(storeId, partner.id, orderId)
    await this.cancellation.cancel(storeId, orderId, actor, {
      guard: async (order, trx) => {
        const option = partnerCancelOption(partner.cancelPolicy, order)
        if (option === 'none') {
          throw new AppException(
            'Este pedido já foi entregue a você e não pode mais ser cancelado.',
            409,
            'E_NOT_CANCELLABLE'
          )
        }
        if (option === 'request') {
          throw new AppException(
            'Este pedido já está com a loja. Peça o cancelamento a um gerente.',
            409,
            'E_CANCEL_REQUIRES_APPROVAL'
          )
        }
        if (await Payment.waitingOnMachine(order.id, trx)) {
          throw new AppException(
            'A cobrança deste pedido ainda está na maquininha. Cancele a cobrança antes.',
            409,
            'E_CHARGE_WAITING'
          )
        }
      },
    })
    return await this.show(storeId, partner, orderId)
  }

  /** Asks a manager to cancel it. Asking again while one waits returns that one. */
  async requestCancel(
    storeId: string,
    partner: StorePartner,
    orderId: string,
    reason: string,
    actor: User
  ) {
    const order = await this.orders.findForPartner(storeId, partner.id, orderId)
    const created = await db.transaction(async (trx) => {
      await trx.from('orders').where('id', order.id).forUpdate().select('id').first()
      await order.useTransaction(trx).refresh()
      const waiting = await OrderCancelRequest.query({ client: trx })
        .where({ orderId: order.id, status: CancelRequestStatus.PENDING })
        .first()
      if (waiting) return null
      if (partnerCancelOption(partner.cancelPolicy, order) === 'none') {
        throw new AppException(
          order.status === OrderStatus.CANCELLED
            ? 'Este pedido já foi cancelado.'
            : 'Este pedido já foi entregue a você e não pode mais ser cancelado.',
          409,
          'E_NOT_CANCELLABLE'
        )
      }
      return await OrderCancelRequest.create(
        {
          storeId,
          orderId: order.id,
          requestedById: actor.id,
          reason: reason.trim(),
          status: CancelRequestStatus.PENDING,
        },
        { client: trx }
      )
    })

    if (created) {
      broadcastStoreEvent({
        type: 'order.updated',
        storeId,
        orderId: order.id,
        status: order.status,
      })
      broadcastPartnerEvent({
        type: 'partner.orders.changed',
        storeId,
        partnerId: partner.id,
        orderId: order.id,
      })
      await this.notifications.notifyStoreMembers(
        storeId,
        'order.cancel_requested',
        {
          storeId,
          orderId: order.id,
          orderNumber: order.number,
          requestedBy: actor.name ?? actor.email,
          partnerName: partner.name,
          reason: created.reason,
        },
        { roles: [StoreRole.MANAGER] }
      )
    }
    return await this.show(storeId, partner, orderId)
  }

  async deliver(storeId: string, partner: StorePartner, orderId: string, actor: User) {
    await this.orders.deliverToCustomer(storeId, partner.id, orderId, actor)
    return await this.show(storeId, partner, orderId)
  }

  private async present(partner: StorePartner, orders: Order[]): Promise<PartnerOrder[]> {
    const settlementIds = [
      ...new Set(orders.map((order) => order.partnerSettlementId).filter(Boolean)),
    ] as string[]
    const settlements = settlementIds.length
      ? await db.from('partner_settlements').whereIn('id', settlementIds).select('id', 'paid_at')
      : []
    const charges = orders.length
      ? await Payment.query()
          .whereIn(
            'orderId',
            orders.map((order) => order.id)
          )
          .where({ method: PaymentMethod.POINT, status: 'pending' })
          .where('expiresAt', '>', DateTime.now().toSQL()!)
          .select('orderId')
      : []
    const waiting = new Set(charges.map((payment) => payment.orderId))

    return orders.map((order) => {
      const requests = order.cancelRequests ?? []
      const pending = requests.find((request) => request.status === CancelRequestStatus.PENDING)
      // The latest answer stays visible (a refusal) until the order moves on.
      const latest = pending ?? requests[0] ?? null
      const option = partnerCancelOption(partner.cancelPolicy, order)
      const settledAt = settlements.find((row) => row.id === order.partnerSettlementId)?.paid_at
      return {
        id: order.id,
        number: order.number,
        businessDate: order.businessDate.toISODate()!,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        paymentStatus: order.paymentStatus,
        stage: partnerStage(order),
        subtotal: order.subtotal,
        total: order.total,
        amountDue: order.amountDue,
        commissionAmount: order.commissionAmount ?? 0,
        notes: order.notes,
        readyAt: order.readyAt?.toISO() ?? null,
        completedAt: order.completedAt?.toISO() ?? null,
        partnerDeliveredAt: order.partnerDeliveredAt?.toISO() ?? null,
        settledAt: settledAt ? DateTime.fromJSDate(settledAt).toISO() : null,
        createdAt: order.createdAt.toISO()!,
        items: order.items.map((item) => item.serialize()) as PartnerOrder['items'],
        cancelRequest: latest ? latest.present() : null,
        can: {
          cancel: option === 'cancel' && !waiting.has(order.id),
          requestCancel: option !== 'none' && !pending && option === 'request',
          charge:
            order.status === OrderStatus.PENDING_PAYMENT &&
            order.paymentStatus !== PaymentStatus.PAID &&
            order.amountDue > 0,
          deliver: order.status === OrderStatus.COMPLETED && !order.partnerDeliveredAt,
        },
      }
    })
  }
}
