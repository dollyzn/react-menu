import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import CancelRequestStatus from '#enums/cancel_request_status'
import { broadcastPartnerEvent, broadcastStoreEvent } from '#helpers/realtime'
import Order from '#models/order'
import OrderCancelRequest from '#models/order_cancel_request'
import type User from '#models/user'
import NotificationService from '#services/notification_service'
import OrderCancellationService from '#services/order_cancellation_service'

/**
 * The managers' answer to cancellation requests (a partner past their
 * window, ADR 0024): approving cancels the order (refunded like any other),
 * refusing keeps it going. Answering again the same way is a success.
 */
@inject()
export default class CancelRequestService {
  constructor(
    private cancellation: OrderCancellationService,
    private notifications: NotificationService
  ) {}

  async listPending(storeId: string) {
    const requests = await OrderCancelRequest.query()
      .where({ storeId, status: CancelRequestStatus.PENDING })
      .preload('requestedBy')
      .preload('order', (order) => order.preload('partner'))
      .orderBy('createdAt', 'asc')
    return requests.map((request) => ({
      ...request.present(),
      order: {
        id: request.order.id,
        number: request.order.number,
        customerName: request.order.customerName,
        status: request.order.status,
        total: request.order.total,
        partner: request.order.partner
          ? { id: request.order.partner.id, name: request.order.partner.name }
          : null,
      },
    }))
  }

  async approve(
    storeId: string,
    orderId: string,
    requestId: number,
    actor: User,
    note: string | null
  ) {
    const request = await this.find(storeId, orderId, requestId)
    if (request.status === CancelRequestStatus.APPROVED) return request
    if (request.status === CancelRequestStatus.REJECTED) {
      throw new AppException('Este pedido de cancelamento já foi recusado.', 409, 'E_DECIDED')
    }
    // Closes the request as approved, under the order's lock.
    await this.cancellation.cancel(storeId, orderId, actor, { decisionNote: note })
    // Already cancelled some other way (the expiry, a manager): answered too.
    await OrderCancelRequest.query()
      .where({ id: request.id, status: CancelRequestStatus.PENDING })
      .update({
        status: CancelRequestStatus.APPROVED,
        decided_by_id: actor.id,
        decided_at: DateTime.now().toSQL(),
        decision_note: note,
      })
    await request.refresh()
    await this.told(request, actor, true)
    return request
  }

  async reject(
    storeId: string,
    orderId: string,
    requestId: number,
    actor: User,
    note: string | null
  ) {
    const request = await this.find(storeId, orderId, requestId)
    if (request.status === CancelRequestStatus.REJECTED) return request
    if (request.status === CancelRequestStatus.APPROVED) {
      throw new AppException('Este pedido já foi cancelado.', 409, 'E_DECIDED')
    }
    const changed = await db.transaction(async (trx) => {
      const locked = await OrderCancelRequest.query({ client: trx })
        .where('id', request.id)
        .forUpdate()
        .firstOrFail()
      if (locked.status !== CancelRequestStatus.PENDING) return false
      locked.merge({
        status: CancelRequestStatus.REJECTED,
        decidedById: actor.id,
        decidedAt: DateTime.now(),
        decisionNote: note,
      })
      await locked.useTransaction(trx).save()
      return true
    })
    await request.refresh()
    if (changed) {
      await this.told(request, actor, false)
    } else if ((request.status as CancelRequestStatus) === CancelRequestStatus.APPROVED) {
      // Approved meanwhile (another manager, the order cancelled): too late to refuse.
      throw new AppException('Este pedido já foi cancelado.', 409, 'E_DECIDED')
    }
    return request
  }

  private async find(storeId: string, orderId: string, requestId: number) {
    const request = await OrderCancelRequest.query()
      .where({ id: requestId, orderId, storeId })
      .first()
    if (!request) throw new AppException('Pedido de cancelamento não encontrado.', 404)
    return request
  }

  /** After the decision: the boards refetch and whoever asked is told. */
  private async told(request: OrderCancelRequest, actor: User, approved: boolean) {
    const order = await Order.findOrFail(request.orderId)
    broadcastStoreEvent({
      type: 'order.updated',
      storeId: order.storeId,
      orderId: order.id,
      status: order.status,
    })
    if (order.partnerId) {
      broadcastPartnerEvent({
        type: 'partner.orders.changed',
        storeId: order.storeId,
        partnerId: order.partnerId,
        orderId: order.id,
      })
    }
    if (request.requestedById) {
      await this.notifications.notify(
        'order.cancel_decided',
        {
          storeId: order.storeId,
          orderNumber: order.number,
          approved,
          decidedBy: actor.name ?? actor.email,
          note: request.decisionNote,
        },
        { userIds: [request.requestedById], storeId: order.storeId }
      )
    }
  }
}
