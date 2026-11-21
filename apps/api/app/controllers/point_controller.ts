import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import vine from '@vinejs/vine'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import Store from '#models/store'
import type Payment from '#models/payment'
import type Order from '#models/order'
import OrderService from '#services/order_service'
import PointService from '#services/point_service'
import PartnerService from '#services/partner_service'
import { isPartnerArea } from '#middleware/store_access_middleware'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { partnerTerminalValidator } from '#validators/partner'
import AppException from '#exceptions/app_exception'
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
      // What this charge asks for: all of it, or what was added after it was paid.
      total: payment.amount,
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
    private orders: OrderService,
    private partners: PartnerService
  ) {}

  /** What the POS needs: the machines on and how they charge (no call to Mercado Pago). */
  async show({ params }: HttpContext) {
    const store = await this.store(params)
    // The store's own machines: the ones lent to partners charge only their orders.
    const terminals = await this.point.enabledTerminals(store, { partnerId: null })
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
      ...(data.kitchenAfterPayment !== undefined && {
        pointKitchenAfterPayment: data.kitchenAfterPayment,
      }),
    })
    await store.save()
    return updated(
      this.config(store, await this.point.enabledTerminals(store, { partnerId: null })),
      'Maquininha salva'
    )
  }

  async enable({ params, request }: HttpContext) {
    const store = await this.store(params)
    const { terminalId, name } = await request.validateUsing(pointTerminalValidator)
    await this.point.enable(store, terminalId, name)
    return created(
      this.config(store, await this.point.enabledTerminals(store, { partnerId: null })),
      'Maquininha ativada. Reinicie a maquininha para ela receber as cobranças.'
    )
  }

  async disable({ params }: HttpContext) {
    const store = await this.store(params)
    const terminalId = await terminalParam.validate(params.terminalId)
    await this.point.disable(store, terminalId)
    return messageOnly('Maquininha desativada nesta loja')
  }

  /** Lends a machine to a partner (ADR 0024), or gives it back to the store (`partnerId: null`). */
  async assignPartner({ params, request }: HttpContext) {
    const store = await this.store(params)
    const terminalId = await terminalParam.validate(params.terminalId)
    const { partnerId } = await request.validateUsing(partnerTerminalValidator)
    const terminal = await this.point.assignTerminal(store, terminalId, partnerId)
    return updated(
      { terminalId: terminal.terminalId, name: terminal.name, partnerId: terminal.partnerId },
      partnerId ? 'Maquininha emprestada ao parceiro' : 'Maquininha de volta à loja'
    )
  }

  /** "Cobrar na maquininha": sends what the order still owes to a machine. */
  async charge(ctx: HttpContext) {
    const { request } = ctx
    const { store, order } = await this.order(ctx)
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
  async pendingCharges(ctx: HttpContext) {
    const store = await this.store(ctx.params)
    const charges = await this.point.pendingCharges(store, {
      check: ctx.request.qs().check === '1',
      partnerId: await this.partnerOf(ctx, store),
    })
    // The machines' names once for the whole list.
    const terminals = await this.point.enabledTerminals(store)
    return ok(charges.map((payment) => this.present(payment, payment.order, terminals)))
  }

  /** The POS follows the charge; `?check=1` also asks Mercado Pago. */
  async showCharge(ctx: HttpContext) {
    const { params, request } = ctx
    const { store, order } = await this.order(ctx)
    const paymentId = await uuidValidator.validate(params.paymentId)
    const payment = await this.point.find(order, paymentId)
    if (request.qs().check === '1') await this.point.check(order, store, payment)
    return ok(await this.view(store, payment, order))
  }

  async cancelCharge(ctx: HttpContext) {
    const { params } = ctx
    const { store, order } = await this.order(ctx)
    const paymentId = await uuidValidator.validate(params.paymentId)
    const payment = await this.point.cancel(store, await this.point.find(order, paymentId))
    return updated(await this.view(store, payment, order), 'Cobrança cancelada')
  }

  /** Development only: the pretend or virtual machine answers. */
  async simulate(ctx: HttpContext) {
    const { params, request } = ctx
    const { store, order } = await this.order(ctx)
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
    return this.present(payment, order, await this.point.enabledTerminals(store), resumed)
  }

  private present(
    payment: Payment,
    order: Order,
    terminals: { terminalId: string; name: string }[],
    resumed = false
  ) {
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
      kitchenAfterPayment: store.pointKitchenAfterPayment,
    }
  }

  private async store(params: Record<string, string>) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return await Store.findOrFail(storeId)
  }

  /**
   * The order of the route. The store's POS charges the store's orders; the
   * partner area (same actions, ADR 0024) only the partner's own.
   */
  private async order(ctx: HttpContext) {
    const store = await this.store(ctx.params)
    const orderId = await uuidValidator.validate(ctx.params.orderId)
    const order = await this.orders.find(store.id, orderId)
    if (order.partnerId !== (await this.partnerOf(ctx, store))) {
      throw new AppException('Pedido não encontrado', 404)
    }
    return { store, order }
  }

  /** In the partner area, the signed-in partner's id; elsewhere null (the store's own). */
  private async partnerOf(ctx: HttpContext, store: Store) {
    if (!isPartnerArea(ctx.route?.pattern)) return null
    const partner = await this.partners.forMember(store.id, ctx.auth.getUserOrFail())
    return partner.id
  }
}
