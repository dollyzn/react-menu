import { randomUUID } from 'node:crypto'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import env from '#start/env'
import AppException from '#exceptions/app_exception'
import OrderStatus from '#enums/order_status'
import PaymentAttemptStatus from '#enums/payment_attempt_status'
import PaymentMethod from '#enums/payment_method'
import PaymentStatus from '#enums/payment_status'
import Order from '#models/order'
import Payment from '#models/payment'
import PointTerminal from '#models/point_terminal'
import type Store from '#models/store'
import MercadoPagoClient, { type MercadoPagoOrder } from '#payments/mercado_pago_client'
import {
  describeTerminal,
  pointReference,
  type MercadoPagoTerminal,
  type PointPaymentType,
} from '#payments/point'
import PaymentService from '#services/payment_service'

/** How long a charge waits on the machine before Mercado Pago drops it. */
const CHARGE_TTL_MINUTES = 10

/** Development only: one pretend machine, approved from the POS. */
const FAKE_TERMINAL_ID = 'FAKE_POINT__TESTE'
const fakeEnabled = () =>
  env.get('NODE_ENV') !== 'production' && env.get('PAYMENTS_FAKE_GATEWAY') === true

export type PointChargeInput = {
  terminalId?: string
  /** Null: the customer picks on the machine. */
  paymentType: PointPaymentType | null
  installments?: number
  idempotencyKey?: string
}

/**
 * Mercado Pago Point (ADR 0020): the store's card machines, charged from
 * the POS on the same Orders API and account as the online checkout. The
 * charge waits on the machine; the "order" webhook (or a check from the POS)
 * settles it like any other attempt.
 */
@inject()
export default class PointService {
  constructor(
    private client: MercadoPagoClient,
    private payments: PaymentService
  ) {}

  /** Charging on a machine is possible: Mercado Pago set up (or the dev fake). */
  available(store: Store) {
    return Boolean(store.mercadoPagoAccessToken) || fakeEnabled()
  }

  /** The account's machines, with the ones this store charges from. */
  async terminals(store: Store) {
    const enabled = await PointTerminal.query().where('storeId', store.id).orderBy('name')
    const listed: MercadoPagoTerminal[] = store.mercadoPagoAccessToken
      ? await this.client.listTerminals(store.mercadoPagoAccessToken)
      : fakeEnabled()
        ? [{ id: FAKE_TERMINAL_ID, operating_mode: 'PDV' }]
        : []
    const byId = new Map(enabled.map((terminal) => [terminal.terminalId, terminal]))
    return listed.map((terminal) => {
      const mine = byId.get(terminal.id)
      return {
        id: terminal.id,
        ...describeTerminal(terminal.id),
        operatingMode: terminal.operating_mode ?? 'UNDEFINED',
        posId: terminal.pos_id ?? null,
        enabled: Boolean(mine),
        name: mine?.name ?? null,
      }
    })
  }

  /** Machines the POS can charge on (no call to Mercado Pago). */
  async enabledTerminals(store: Store) {
    return await PointTerminal.query().where('storeId', store.id).orderBy('name')
  }

  /**
   * Turns a machine on for this store and puts it in PDV mode (charges
   * come from the system). The machine must be restarted afterwards.
   */
  async enable(store: Store, terminalId: string, name: string) {
    const listed = await this.terminals(store)
    if (!listed.some((terminal) => terminal.id === terminalId)) {
      throw new AppException('Maquininha não encontrada nesta conta do Mercado Pago.', 404)
    }
    if (store.mercadoPagoAccessToken) {
      await this.client.setTerminalMode(store.mercadoPagoAccessToken, terminalId, 'PDV')
    }
    const terminal = await PointTerminal.updateOrCreate(
      { storeId: store.id, terminalId },
      { storeId: store.id, terminalId, name }
    )
    return terminal
  }

  /** Stops charging on it here; back to taking typed amounts on the machine. */
  async disable(store: Store, terminalId: string) {
    const terminal = await PointTerminal.query()
      .where({ storeId: store.id, terminalId })
      .firstOrFail()
    if (store.mercadoPagoAccessToken) {
      await this.client.setTerminalMode(store.mercadoPagoAccessToken, terminalId, 'STANDALONE')
    }
    await terminal.delete()
  }

  /** Sends the order's amount to a machine. One charge at a time per order. */
  async charge(order: Order, store: Store, input: PointChargeInput) {
    if (order.status === OrderStatus.CANCELLED) {
      throw new AppException('Este pedido foi cancelado.', 409, 'E_NOT_PAYABLE')
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new AppException('Este pedido já está pago.', 409, 'E_NOT_PAYABLE')
    }
    if (input.paymentType && !store.pointPaymentTypes.includes(input.paymentType)) {
      throw new AppException('Esta forma de pagamento não está ativa na maquininha.', 422)
    }
    const installments = input.paymentType === 'credit_card' ? (input.installments ?? 1) : 1
    if (installments > store.pointMaxInstallments) {
      throw new AppException(
        store.pointMaxInstallments === 1
          ? 'Esta loja cobra só à vista na maquininha.'
          : `Esta loja parcela em até ${store.pointMaxInstallments}x na maquininha.`,
        422
      )
    }

    const terminals = await this.enabledTerminals(store)
    const terminal = input.terminalId
      ? terminals.find((candidate) => candidate.terminalId === input.terminalId)
      : terminals.length === 1
        ? terminals[0]
        : undefined
    if (!terminal) {
      throw new AppException(
        terminals.length === 0
          ? 'Nenhuma maquininha ativa nesta loja. Ative uma em Configurações > Pagamentos.'
          : 'Escolha a maquininha.',
        422,
        'E_NO_TERMINAL'
      )
    }

    const open = await this.pending(order)
    if (open) {
      throw new AppException(
        'Já tem uma cobrança deste pedido na maquininha. Cancele ou espere ela terminar.',
        409,
        'E_CHARGE_IN_PROGRESS'
      )
    }

    const attempt = randomUUID().slice(0, 8)
    const result = store.mercadoPagoAccessToken
      ? await this.client.createPointOrder(
          store.mercadoPagoAccessToken,
          {
            type: 'point',
            external_reference: pointReference(order.id, attempt),
            expiration_time: `PT${CHARGE_TTL_MINUTES}M`,
            description: `Pedido #${order.number} · ${store.name}`.slice(0, 150),
            transactions: { payments: [{ amount: order.total.toFixed(2) }] },
            config: {
              point: {
                terminal_id: terminal.terminalId,
                print_on_terminal: store.pointPrintTicket ? 'seller_ticket' : 'no_ticket',
              },
              ...(input.paymentType && {
                payment_method: {
                  default_type: input.paymentType,
                  ...(input.paymentType === 'credit_card' && {
                    default_installments: installments,
                    installments_cost: 'seller' as const,
                  }),
                },
              }),
            },
          },
          input.idempotencyKey ?? randomUUID()
        )
      : this.fakeCharge(order, attempt)

    return await Payment.create({
      orderId: order.id,
      storeId: store.id,
      gateway: store.mercadoPagoAccessToken ? 'mercado_pago' : 'fake',
      method: PaymentMethod.POINT,
      gatewayPaymentId: result.id,
      status: PaymentAttemptStatus.PENDING,
      statusDetail: result.status_detail ?? 'created',
      amount: order.total,
      pointTerminalId: terminal.terminalId,
      expiresAt: DateTime.now().plus({ minutes: CHARGE_TTL_MINUTES }),
    })
  }

  /** The order's charge still waiting on a machine, if any. */
  async pending(order: Order) {
    return await Payment.query()
      .where({
        orderId: order.id,
        method: PaymentMethod.POINT,
        status: PaymentAttemptStatus.PENDING,
      })
      .where('expiresAt', '>', DateTime.now().toSQL()!)
      .orderBy('createdAt', 'desc')
      .first()
  }

  /** One of the order's machine charges (the POS follows it). */
  async find(order: Order, paymentId: string) {
    return await Payment.query()
      .where({ id: paymentId, orderId: order.id, method: PaymentMethod.POINT })
      .firstOrFail()
  }

  /**
   * Reads the charge from Mercado Pago now (the POS asks while it waits, in
   * case the webhook is slow or can't reach this server).
   */
  async check(order: Order, store: Store, payment: Payment) {
    if (payment.status !== PaymentAttemptStatus.PENDING) return payment
    if (payment.gateway === 'fake' || !payment.gatewayPaymentId) return payment
    const gateway = this.payments.gatewayFor(store)
    if (!gateway || gateway.name !== payment.gateway) return payment
    await this.payments.update(payment, await gateway.fetch(payment.gatewayPaymentId))
    await this.payments.settle(order, payment)
    return payment
  }

  /** Takes a charge back before it is paid. */
  async cancel(store: Store, payment: Payment) {
    if (payment.status !== PaymentAttemptStatus.PENDING) return payment
    if (payment.gateway === 'mercado_pago' && store.mercadoPagoAccessToken) {
      await this.client.cancelOrder(
        store.mercadoPagoAccessToken,
        payment.gatewayPaymentId!,
        `cancel-${payment.gatewayPaymentId}`
      )
    }
    payment.status = PaymentAttemptStatus.EXPIRED
    payment.statusDetail = 'canceled_by_api'
    await payment.save()
    return payment
  }

  /** Development: the pretend machine approves (or refuses) the charge. */
  async simulate(order: Order, payment: Payment, approve: boolean) {
    if (!fakeEnabled() || payment.gateway !== 'fake') {
      throw new AppException('Simulação disponível só no modo de teste.', 404)
    }
    if (payment.status !== PaymentAttemptStatus.PENDING) return payment
    payment.status = approve ? PaymentAttemptStatus.APPROVED : PaymentAttemptStatus.REJECTED
    payment.statusDetail = approve ? 'accredited' : 'rejected_other_reason'
    await payment.save()
    await this.payments.settle(order, payment)
    return payment
  }

  private fakeCharge(order: Order, attempt: string): MercadoPagoOrder {
    if (!fakeEnabled()) throw new AppException('Maquininha indisponível nesta loja.', 422)
    return { id: `fake-point-${order.id}-${attempt}`, status: 'created', status_detail: 'created' }
  }
}
