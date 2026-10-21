import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import env from '#start/env'
import AppException from '#exceptions/app_exception'
import OrderStatus from '#enums/order_status'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import PaymentMethod from '#enums/payment_method'
import PaymentStatus from '#enums/payment_status'
import Order from '#models/order'
import Payment from '#models/payment'
import type Store from '#models/store'
import FakeGateway from '#payments/fake_gateway'
import type { GatewayPayment, PaymentGateway } from '#payments/gateway'
import MercadoPagoClient, { isValidWebhookSignature } from '#payments/mercado_pago_client'
import MercadoPagoGateway from '#payments/mercado_pago_gateway'
import OrderService from '#services/order_service'

/** Pix QR codes are valid for 30 minutes (Mercado Pago's minimum). */
const PIX_TTL_MINUTES = 30

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
    private orders: OrderService
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
      notificationUrl: `${env.get('APP_URL')}/api/v1/webhooks/mercado-pago/${store.id}`,
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
      expiresAt: result.pix?.expiresAt ?? null,
    })

    if (order.paymentMethod !== input.method) {
      order.paymentMethod = input.method
      await order.save()
    }
    await this.settle(order, payment)
    return payment
  }

  /**
   * Payment notifications. The body is never trusted: after checking the
   * signature, the payment is fetched from Mercado Pago with the store's token.
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
    if (input.type !== 'payment') return

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
      if (result.status === PaymentAttemptStatus.APPROVED) {
        await this.orders.markPaid(order, { mercadoPagoPaymentId: result.gatewayPaymentId })
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
   * After a paid order is cancelled: refunds approved payments. A failure
   * is logged and left for a manual refund (see the roadmap: queue retries).
   */
  async refundCancelled(order: Order, store: Store) {
    if (order.status !== OrderStatus.CANCELLED || order.paymentStatus !== PaymentStatus.PAID) return
    const approved = await Payment.query().where({
      orderId: order.id,
      status: PaymentAttemptStatus.APPROVED,
    })
    // Legacy Checkout Pro orders only have the payment id on the order.
    const targets: { gatewayPaymentId: string; payment?: Payment }[] = approved.length
      ? approved.map((payment) => ({ gatewayPaymentId: payment.gatewayPaymentId!, payment }))
      : order.mercadoPagoPaymentId
        ? [{ gatewayPaymentId: order.mercadoPagoPaymentId }]
        : []
    if (targets.length === 0) return

    try {
      for (const target of targets) {
        const gateway =
          target.payment?.gateway === 'fake' ? new FakeGateway() : this.gatewayFor(store)
        if (!gateway) throw new Error('no gateway for the refund')
        await gateway.refund(target.gatewayPaymentId, `refund-${target.gatewayPaymentId}`)
        if (target.payment) {
          target.payment.status = PaymentAttemptStatus.REFUNDED
          await target.payment.save()
        }
      }
      order.paymentStatus = PaymentStatus.REFUNDED
      await order.save()
    } catch (error) {
      logger.error({ err: error, orderId: order.id }, 'automatic refund failed: refund it manually')
    }
  }

  private async update(payment: Payment, result: GatewayPayment) {
    payment.status = result.status
    payment.statusDetail = result.statusDetail
    await payment.save()
  }

  /** Mirrors the attempt on the order (only the latest attempt decides). */
  private async settle(order: Order, payment: Payment) {
    if (payment.status === PaymentAttemptStatus.APPROVED) {
      await this.orders.markPaid(order, {
        mercadoPagoPaymentId:
          payment.gateway === 'mercado_pago' ? (payment.gatewayPaymentId ?? undefined) : undefined,
      })
      return
    }
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
