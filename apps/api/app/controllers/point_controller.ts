import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import Store from '#models/store'
import type Payment from '#models/payment'
import type Order from '#models/order'
import OrderService from '#services/order_service'
import PointService from '#services/point_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import {
  pointChargeValidator,
  pointSettingsValidator,
  pointSimulateValidator,
  pointTerminalValidator,
  terminalIdRule,
} from '#validators/point'

const terminalParam = vine.create(terminalIdRule)

/** What the POS shows while a charge waits on the machine. */
function charge(
  payment: Payment,
  order: Order,
  extra: { simulated: boolean; terminalName: string | null; resumed?: boolean }
) {
  return {
    id: payment.id,
    order: {
      id: order.id,
      number: order.number,
      total: order.total,
      customerName: order.customerName,
    },
    status: payment.status,
    statusDetail: payment.statusDetail,
    terminalId: payment.pointTerminalId,
    amount: payment.amount,
    expiresAt: payment.expiresAt?.toISO() ?? null,
    createdAt: payment.createdAt.toISO(),
    /** "Simular" in the POS: the dev fake or the virtual machine (test credentials). */
    simulated: extra.simulated,
    terminalName: extra.terminalName,
    /** The order already had this charge waiting: the POS picks it up again. */
    resumed: extra.resumed ?? false,
  }
}

/** Mercado Pago Point card machines (ADR 0020). */
@inject()
export default class PointController {
  constructor(
    private point: PointService,
    private orders: OrderService
  ) {}

  /** What the POS needs: the machines on and how they charge (no call to Mercado Pago). */
  async show({ params }: HttpContext) {
    const store = await this.store(params)
    const terminals = await this.point.enabledTerminals(store)
    return ok(this.config(store, terminals))
  }

  /** Every machine of the account (managers set them up). */
  async terminals({ params }: HttpContext) {
    const store = await this.store(params)
    return ok(await this.point.terminals(store))
  }

  async updateSettings({ params, request }: HttpContext) {
    const store = await this.store(params)
    const data = await request.validateUsing(pointSettingsValidator)
    store.merge({
      pointPaymentTypes: data.paymentTypes,
      pointMaxInstallments: data.maxInstallments,
      pointPrintTicket: data.printTicket,
    })
    await store.save()
    return updated(this.config(store, await this.point.enabledTerminals(store)), 'Maquininha salva')
  }

  async enable({ params, request }: HttpContext) {
    const store = await this.store(params)
    const { terminalId, name } = await request.validateUsing(pointTerminalValidator)
    await this.point.enable(store, terminalId, name)
    return created(
      this.config(store, await this.point.enabledTerminals(store)),
      'Maquininha ativada. Reinicie a maquininha para ela receber as cobranças.'
    )
  }

  async disable({ params }: HttpContext) {
    const store = await this.store(params)
    const terminalId = await terminalParam.validate(params.terminalId)
    await this.point.disable(store, terminalId)
    return messageOnly('Maquininha desativada nesta loja')
  }

  /** "Cobrar na maquininha": sends the order's total to a machine. */
  async charge({ params, request }: HttpContext) {
    const { store, order } = await this.order(params)
    const input = await request.validateUsing(pointChargeValidator)
    const { payment, resumed } = await this.point.charge(order, store, {
      ...input,
      idempotencyKey: request.header('idempotency-key'),
    })
    return created(
      await this.view(store, payment, order, resumed),
      resumed ? 'Esta cobrança já estava na maquininha' : 'Cobrança enviada para a maquininha'
    )
  }

  /** Charges waiting on the store's machines (the POS lists them to open again). */
  async pendingCharges({ params, request }: HttpContext) {
    const store = await this.store(params)
    const charges = await this.point.pendingCharges(store, { check: Boolean(request.qs().check) })
    return ok(await Promise.all(charges.map((payment) => this.view(store, payment, payment.order))))
  }

  /** The POS follows the charge; `?check=1` also asks Mercado Pago. */
  async showCharge({ params, request }: HttpContext) {
    const { store, order } = await this.order(params)
    const paymentId = await uuidValidator.validate(params.paymentId)
    const payment = await this.point.find(order, paymentId)
    if (request.qs().check) await this.point.check(order, store, payment)
    return ok(await this.view(store, payment, order))
  }

  async cancelCharge({ params }: HttpContext) {
    const { store, order } = await this.order(params)
    const paymentId = await uuidValidator.validate(params.paymentId)
    const payment = await this.point.cancel(store, await this.point.find(order, paymentId))
    return updated(await this.view(store, payment, order), 'Cobrança cancelada')
  }

  /** Development only: the pretend or virtual machine answers. */
  async simulate({ params, request }: HttpContext) {
    const { store, order } = await this.order(params)
    const paymentId = await uuidValidator.validate(params.paymentId)
    const { approve } = await request.validateUsing(pointSimulateValidator)
    const payment = await this.point.simulate(
      order,
      store,
      await this.point.find(order, paymentId),
      approve
    )
    return updated(
      await this.view(store, payment, order),
      approve ? 'Pagamento aprovado (simulado)' : 'Pagamento recusado (simulado)'
    )
  }

  private async view(store: Store, payment: Payment, order: Order, resumed = false) {
    const terminals = await this.point.enabledTerminals(store)
    const terminalName =
      terminals.find((terminal) => terminal.terminalId === payment.pointTerminalId)?.name ?? null
    return charge(payment, order, {
      simulated: this.point.simulatable(payment),
      terminalName,
      resumed,
    })
  }

  private config(store: Store, terminals: { terminalId: string; name: string }[]) {
    return {
      available: this.point.available(store),
      terminals: terminals.map(({ terminalId, name }) => ({ id: terminalId, name })),
      paymentTypes: store.pointPaymentTypes,
      maxInstallments: store.pointMaxInstallments,
      printTicket: store.pointPrintTicket,
    }
  }

  private async store(params: Record<string, string>) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return await Store.findOrFail(storeId)
  }

  private async order(params: Record<string, string>) {
    const store = await this.store(params)
    const orderId = await uuidValidator.validate(params.orderId)
    const order = await this.orders.find(store.id, orderId)
    return { store, order }
  }
}
