import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import env from '#start/env'
import AppException from '#exceptions/app_exception'
import OrderStatus from '#enums/order_status'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import PaymentMethod from '#enums/payment_method'
import PaymentStatus from '#enums/payment_status'
import Order from '#models/order'
import Payment from '#models/payment'
import SendOrderReceipt from '#jobs/send_order_receipt'
import mail from '@adonisjs/mail/services/main'
import OrderRefundNotification from '#mails/order_refund_notification'
import { storeBrand } from '#mails/layout'
import { orderEmailData } from '#mails/order_email_data'
import type Store from '#models/store'
import FakeGateway from '#payments/fake_gateway'
import type { GatewayPayment, PaymentGateway } from '#payments/gateway'
import MercadoPagoClient, { isValidWebhookSignature } from '#payments/mercado_pago_client'
import MercadoPagoGateway from '#payments/mercado_pago_gateway'
import OrderService from '#services/order_service'
import InventoryService from '#services/inventory_service'

/** Pix QR codes are valid for 30 minutes (Mercado Pago's minimum). */
const PIX_TTL_MINUTES = 30
/** Mercado Pago's limit for the payer to finish a 3-D Secure challenge. */
const CHALLENGE_TTL_MINUTES = 40

type WebhookInput = {
  type: string | undefined
  dataId: string | undefined
  signature: string | undefined
  requestId: string | undefined
}

export type PayInput = {
  method: PaymentMethod
  payer: { email: string }
  card?: {
    token: string
    installments: number
    paymentMethodId: string
    issuerId?: string
    identification?: { type: string; number: string }
  }
  idempotencyKey?: string
}

const fakeGatewayEnabled = () =>
  env.get('NODE_ENV') !== 'production' && env.get('PAYMENTS_FAKE_GATEWAY') === true

/**
 * In-app checkout (ADR 0015). Orders are paid on their tracking page with
 * the methods the store's gateway offers (Pix, card); each try is a Payment.
 */
@inject()
export default class PaymentService {
  constructor(
    private client: MercadoPagoClient,
    private orders: OrderService,
    private inventory: InventoryService
  ) {}

  /** The store's gateway: its Mercado Pago account, or the dev fake. */
  gatewayFor(store: Store): PaymentGateway | null {
    if (store.mercadoPagoAccessToken) return new MercadoPagoGateway(this.client, store)
    if (fakeGatewayEnabled()) return new FakeGateway()
    return null
  }

  /** Methods a customer can pick for a new order, in display order. */
  checkoutMethods(store: Store): PaymentMethod[] {
    return [
      ...(this.gatewayFor(store)?.methods ?? []),
      ...(store.counterPaymentEnabled ? [PaymentMethod.COUNTER] : []),
    ]
  }

  /** Online methods available to pay an existing order. */
  onlineMethods(store: Store): PaymentMethod[] {
    return this.gatewayFor(store)?.methods ?? []
  }

  /** Every attempt of the order, oldest first (staff order detail). */
  async listFor(order: Order) {
    return await Payment.query().where('orderId', order.id).orderBy('createdAt', 'asc')
  }

  /**
   * Manual "Reembolsar agora" from the staff order detail, for a cancelled
   * paid order whose automatic refund didn't go through.
   */
  async refundNow(order: Order, store: Store) {
    if (order.status !== OrderStatus.CANCELLED || order.paymentStatus !== PaymentStatus.PAID) {
      throw new AppException(
        'Este pedido não tem pagamento a devolver.',
        409,
        'E_NOTHING_TO_REFUND'
      )
    }
    await this.refundCancelled(order, store)
  }

  /** Latest attempt of the order, shown on its tracking page. */
  async latestFor(order: Order) {
    return await Payment.query().where('orderId', order.id).orderBy('createdAt', 'desc').first()
  }

  /**
   * Starts a payment for an order waiting for it. A Pix still valid is
   * reused (reloads and retries show the same QR code); a card is charged
   * now and approved or rejected on the spot.
   */
  async pay(order: Order, store: Store, input: PayInput) {
    if (
      order.status !== OrderStatus.PENDING_PAYMENT ||
      order.paymentStatus === PaymentStatus.PAID
    ) {
      throw new AppException('Este pedido não está aguardando pagamento.', 409, 'E_NOT_PAYABLE')
    }
    const gateway = this.gatewayFor(store)
    if (!gateway || !gateway.methods.includes(input.method)) {
      throw new AppException('Esta forma de pagamento não está disponível.', 422)
    }

    if (
      input.method === PaymentMethod.CARD &&
      (input.card?.installments ?? 1) > store.maxInstallments
    ) {
      throw new AppException(
        store.maxInstallments === 1
          ? 'Esta loja aceita cartão só à vista.'
          : `Esta loja parcela em até ${store.maxInstallments}x.`,
        422
      )
    }

    // The order was placed earlier; the counter may have used the stock since.
    await this.assertStillInStock(order, store)

    if (input.method === PaymentMethod.PIX) {
      const open = await Payment.query()
        .where({
          orderId: order.id,
          method: PaymentMethod.PIX,
          status: PaymentAttemptStatus.PENDING,
        })
        .where('expiresAt', '>', DateTime.now().plus({ minutes: 1 }).toSQL()!)
        .orderBy('createdAt', 'desc')
        .first()
      if (open) return open
    }

    const request = {
      orderId: order.id,
      amount: order.total,
      description: `Pedido #${order.number} · ${store.name}`,
      payer: { name: order.customerName, email: input.payer.email },
      statementDescriptor: store.name,
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    }
    const result =
      input.method === PaymentMethod.PIX
        ? await gateway.createPix({
            ...request,
            expiresAt: DateTime.now().plus({ minutes: PIX_TTL_MINUTES }),
          })
        : await gateway.createCard({ ...request, card: input.card! })

    const payment = await Payment.create({
      orderId: order.id,
      storeId: store.id,
      gateway: gateway.name,
      method: input.method,
      gatewayPaymentId: result.gatewayPaymentId,
      status: result.status,
      statusDetail: result.statusDetail,
      amount: order.total,
      pixQrCode: result.pix?.qrCode ?? null,
      pixTicketUrl: result.pix?.ticketUrl ?? null,
      challengeUrl: result.challengeUrl ?? null,
      // A 3-D Secure challenge lasts 40 minutes, then Mercado Pago expires the order.
      expiresAt:
        result.pix?.expiresAt ??
        (result.challengeUrl ? DateTime.now().plus({ minutes: CHALLENGE_TTL_MINUTES }) : null),
      payerEmail: input.payer.email.trim().toLowerCase(),
    })

    if (order.paymentMethod !== input.method) {
      order.paymentMethod = input.method
      await order.save()
    }
    await this.settle(order, payment)
    return payment
  }

  /**
   * Mercado Pago notifications, set up in the store's Mercado Pago panel:
   * "Order" for attempts on the Orders API, "Pagamentos" for older ones. The
   * body is never trusted: after checking the signature, the order (or
   * payment) is fetched from Mercado Pago with the store's token.
   */
  async handleWebhook(store: Store, input: WebhookInput) {
    if (!store.mercadoPagoAccessToken || !store.mercadoPagoWebhookSecret) {
      throw new AppException('Pagamento online não configurado', 404)
    }
    if (!input.dataId) throw new AppException('Notificação inválida', 400)
    if (
      !isValidWebhookSignature({
        signature: input.signature,
        requestId: input.requestId,
        dataId: input.dataId,
        secret: store.mercadoPagoWebhookSecret,
      })
    ) {
      throw new AppException('Assinatura inválida', 401, 'E_INVALID_SIGNATURE')
    }
    if (input.type !== 'order' && input.type !== 'payment') return

    const gateway = new MercadoPagoGateway(this.client, store)
    const result = await gateway.fetch(input.dataId)
    const payment = await Payment.query()
      .where({
        storeId: store.id,
        gateway: gateway.name,
        gatewayPaymentId: result.gatewayPaymentId,
      })
      .first()
    const orderId = payment?.orderId ?? result.orderId
    const order = orderId
      ? await Order.query().where({ id: orderId, storeId: store.id }).first()
      : null
    if (!order) {
      logger.warn(
        { paymentId: result.gatewayPaymentId, storeId: store.id },
        'payment for an unknown order'
      )
      return
    }

    if (!payment) {
      // Legacy Checkout Pro order (no Payment row): only approval matters.
      if (order.paymentMethod === PaymentMethod.MERCADO_PAGO) {
        if (result.status === PaymentAttemptStatus.APPROVED) {
          await this.orders.markPaid(order, { mercadoPagoPaymentId: result.gatewayPaymentId })
        }
        return
      }
      // An attempt of this order whose answer never reached us (a timeout
      // after Mercado Pago charged): record it now, so it pays the order or,
      // if the order was paid another way, goes back as a duplicate.
      if (
        input.type === 'order' &&
        result.orderId === order.id &&
        (order.paymentMethod === PaymentMethod.PIX || order.paymentMethod === PaymentMethod.CARD)
      ) {
        const recorded = await Payment.create({
          orderId: order.id,
          storeId: store.id,
          gateway: gateway.name,
          method: result.pix ? PaymentMethod.PIX : PaymentMethod.CARD,
          gatewayPaymentId: result.gatewayPaymentId,
          status: result.status,
          statusDetail: result.statusDetail,
          amount: order.total,
        })
        logger.warn(
          { orderId: order.id, paymentId: recorded.id },
          'payment attempt recorded from its webhook'
        )
        await this.settle(order, recorded)
      }
      return
    }
    await this.update(payment, result)
    await this.settle(order, payment)
  }

  /** Development: approve the order's pending fake Pix. */
  async simulateApproval(order: Order) {
    const payment = await this.latestFor(order)
    if (!fakeGatewayEnabled() || payment?.gateway !== 'fake') {
      throw new AppException('Simulação disponível só no modo de teste.', 404)
    }
    payment.status = PaymentAttemptStatus.APPROVED
    payment.statusDetail = 'accredited'
    await payment.save()
    await this.settle(order, payment)
    return payment
  }

  /**
   * After a paid order is cancelled: refunds approved payments. Throws when
   * the gateway fails, so the RefundOrder job retries it.
   */
  async refundCancelled(order: Order, store: Store) {
    if (order.status !== OrderStatus.CANCELLED || order.paymentStatus !== PaymentStatus.PAID) return
    const settled = await Payment.query()
      .where('orderId', order.id)
      .whereIn('status', [PaymentAttemptStatus.APPROVED, PaymentAttemptStatus.REFUNDED])
    const approved = settled.filter((payment) => payment.status === PaymentAttemptStatus.APPROVED)
    // Legacy Checkout Pro orders only have the payment id on the order.
    const targets: { gatewayPaymentId: string; payment?: Payment }[] = approved.length
      ? approved.map((payment) => ({ gatewayPaymentId: payment.gatewayPaymentId!, payment }))
      : order.mercadoPagoPaymentId && settled.length === 0
        ? [{ gatewayPaymentId: order.mercadoPagoPaymentId }]
        : []
    if (targets.length === 0) {
      // Already refunded attempts (the webhook told us of a refund made in
      // Mercado Pago): the order only needs to say so.
      if (settled.length > 0) {
        order.paymentStatus = PaymentStatus.REFUNDED
        await order.save()
      }
      return
    }

    for (const target of targets) {
      const gateway =
        target.payment?.gateway === 'fake' ? new FakeGateway() : this.gatewayFor(store)
      if (!gateway) throw new Error('no gateway to refund the payment')
      // Refunded elsewhere first (the store's Mercado Pago app or panel): the
      // provider refuses a second refund, so only record it. A failed lookup
      // still tries the refund, which answers for itself.
      const current = await gateway.fetch(target.gatewayPaymentId).catch(() => null)
      if (current?.status !== PaymentAttemptStatus.REFUNDED) {
        await gateway.refund(target.gatewayPaymentId, `refund-${target.gatewayPaymentId}`)
      }
      if (target.payment) {
        target.payment.status = PaymentAttemptStatus.REFUNDED
        await target.payment.save()
      }
    }
    order.paymentStatus = PaymentStatus.REFUNDED
    await order.save()

    const payerEmail = targets.find((target) => target.payment?.payerEmail)?.payment?.payerEmail
    if (payerEmail) {
      await order.load((loader) =>
        loader.preload('items', (items) => items.orderBy('id').preload('addons'))
      )
      await mail.sendLater(
        new OrderRefundNotification(payerEmail, storeBrand(store), orderEmailData(order))
      )
    }
  }

  /**
   * Until when the order may still be paid by an attempt in progress: a
   * valid Pix or a card in a 3-D Secure challenge (their deadline), or a
   * card in review (half an hour more).
   */
  async payableUntil(order: Order): Promise<DateTime | null> {
    const latest = await this.latestFor(order)
    if (latest?.status !== PaymentAttemptStatus.PENDING) return null
    if (latest.expiresAt) return latest.expiresAt > DateTime.now() ? latest.expiresAt : null
    if (latest.method === PaymentMethod.PIX) return null
    return DateTime.now().plus({ minutes: 30 })
  }

  /**
   * The payer says they finished (a 3-D Secure challenge): read the latest
   * pending attempt from the gateway now instead of waiting for the webhook.
   */
  async sync(order: Order, store: Store) {
    const payment = await this.latestFor(order)
    if (payment?.status !== PaymentAttemptStatus.PENDING || !payment.gatewayPaymentId) return
    const gateway = payment.gateway === 'fake' ? new FakeGateway() : this.gatewayFor(store)
    if (!gateway || gateway.name !== payment.gateway) return
    await this.update(payment, await gateway.fetch(payment.gatewayPaymentId))
    await this.settle(order, payment)
  }

  /**
   * Before giving up on an unpaid order: asks the gateway about every attempt
   * still pending here. A webhook that never arrived (a wrong secret, an
   * outage) must not let a paid Pix be cancelled with the money kept. Throws
   * when the gateway can't be reached, so the caller retries instead of
   * cancelling blind.
   */
  async syncPending(order: Order, store: Store) {
    const pending = await Payment.query().where({
      orderId: order.id,
      status: PaymentAttemptStatus.PENDING,
    })
    for (const payment of pending) {
      if (!payment.gatewayPaymentId) continue
      const gateway = payment.gateway === 'fake' ? new FakeGateway() : this.gatewayFor(store)
      if (!gateway || gateway.name !== payment.gateway) continue
      await this.update(payment, await gateway.fetch(payment.gatewayPaymentId))
      await this.settle(order, payment)
    }
  }

  /** Online orders take their stock only once paid: check before charging. */
  private async assertStillInStock(order: Order, store: Store) {
    await db.transaction(async (trx) => {
      const lines = await order.related('items').query().useTransaction(trx).preload('addons')
      await this.inventory.assertStock(
        store,
        lines.map((line) => ({
          itemId: line.itemId,
          addonIds: line.addons.flatMap((addon) => (addon.addonId ? [addon.addonId] : [])),
          quantity: line.quantity,
          name: line.name,
        })),
        trx
      )
    })
  }

  async update(payment: Payment, result: GatewayPayment) {
    payment.status = result.status
    payment.statusDetail = result.statusDetail
    // The challenge page only matters while the payer still has to confirm.
    const challengeUrl =
      result.status === PaymentAttemptStatus.PENDING ? (result.challengeUrl ?? null) : null
    // A challenge that shows up later (webhook, sync) gets Mercado Pago's 40 minutes too.
    if (challengeUrl && !payment.challengeUrl && !payment.expiresAt) {
      payment.expiresAt = DateTime.now().plus({ minutes: CHALLENGE_TTL_MINUTES })
    }
    payment.challengeUrl = challengeUrl
    await payment.save()
  }

  /**
   * Gives back an approved payment the order didn't need: it was already
   * paid by another one. Throws when the gateway fails (the job retries).
   */
  async refundDuplicate(payment: Payment, store: Store) {
    if (payment.status !== PaymentAttemptStatus.APPROVED || !payment.gatewayPaymentId) return
    const gateway = payment.gateway === 'fake' ? new FakeGateway() : this.gatewayFor(store)
    if (!gateway) throw new Error('no gateway to refund the payment')
    const current = await gateway.fetch(payment.gatewayPaymentId).catch(() => null)
    if (current?.status !== PaymentAttemptStatus.REFUNDED) {
      await gateway.refund(payment.gatewayPaymentId, `refund-${payment.gatewayPaymentId}`)
    }
    payment.status = PaymentAttemptStatus.REFUNDED
    payment.statusDetail = 'duplicate_refunded'
    await payment.save()
    logger.warn(
      { orderId: payment.orderId, paymentId: payment.id },
      'order paid twice: the extra payment was refunded'
    )
  }

  /** Mirrors the attempt on the order (only the latest attempt decides). */
  async settle(order: Order, payment: Payment) {
    if (payment.status === PaymentAttemptStatus.APPROVED) {
      await this.orders.markPaid(order, {
        mercadoPagoPaymentId:
          payment.gateway === 'mercado_pago' ? (payment.gatewayPaymentId ?? undefined) : undefined,
        paymentMethod: payment.method === PaymentMethod.POINT ? PaymentMethod.POINT : undefined,
      })
      // markPaid records, under the order's lock, which approval paid it. One
      // that isn't it came second (cash first, another charge, a late Pix):
      // it goes back. The same approval notified twice finds its own id.
      if (payment.gateway === 'mercado_pago') {
        await order.refresh()
        if (order.mercadoPagoPaymentId !== payment.gatewayPaymentId) {
          const { default: RefundDuplicatePayment } = await import('#jobs/refund_duplicate_payment')
          await RefundDuplicatePayment.dispatchFor(payment)
          return
        }
      }
      await SendOrderReceipt.dispatchFor(payment)
      // Paid after it expired (a late Pix): give the money back.
      if (order.status === OrderStatus.CANCELLED) {
        const { default: RefundOrder } = await import('#jobs/refund_order')
        await RefundOrder.dispatchFor(order)
      }
      return
    }
    // A card machine charge that didn't go through leaves the order as it
    // was (in the kitchen, to be paid): try again or take it another way.
    if (payment.method === PaymentMethod.POINT) return
    const latest = await this.latestFor(order)
    if (latest?.id !== payment.id) return
    if (payment.status === PaymentAttemptStatus.PENDING) await this.orders.markPaymentPending(order)
    if (
      payment.status === PaymentAttemptStatus.REJECTED ||
      payment.status === PaymentAttemptStatus.EXPIRED
    ) {
      await this.orders.markPaymentFailed(order)
    }
  }
}
