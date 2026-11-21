import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { created, ok, updated } from '#helpers/api_response'
import PartnerCommissionService from '#services/partner_commission_service'
import PartnerOrderService from '#services/partner_order_service'
import PartnerService from '#services/partner_service'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { partnerOrderValidator } from '#validators/order'
import { cancelRequestValidator, partnerOrdersValidator } from '#validators/partner'

/**
 * The partner area (ADR 0024): `/stores/:storeId/partner/*`, partners only
 * (`storeAccess`), always scoped to the signed-in partner's partner.
 */
@inject()
export default class PartnerAreaController {
  constructor(
    private partners: PartnerService,
    private partnerOrders: PartnerOrderService,
    private commission: PartnerCommissionService
  ) {}

  async context(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    return ok(await this.partnerOrders.context(storeId, partner))
  }

  async menu(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    return ok(await this.partnerOrders.menu(storeId, partner))
  }

  async orders(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const { date } = await partnerOrdersValidator.validate(ctx.request.qs())
    return ok(
      await this.partnerOrders.list(storeId, partner, {
        date: date ? DateTime.fromISO(date, { zone: BUSINESS_TIMEZONE }) : undefined,
      })
    )
  }

  async show(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const orderId = await uuidValidator.validate(ctx.params.orderId)
    return ok(await this.partnerOrders.show(storeId, partner, orderId))
  }

  async store(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const input = await ctx.request.validateUsing(partnerOrderValidator)
    const order = await this.partnerOrders.create(
      storeId,
      partner,
      input,
      ctx.auth.getUserOrFail(),
      ctx.request.header('idempotency-key') ?? null
    )
    return created(order, `Pedido #${order.number} criado. Cobre na maquininha.`)
  }

  async cancel(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const orderId = await uuidValidator.validate(ctx.params.orderId)
    const order = await this.partnerOrders.cancel(
      storeId,
      partner,
      orderId,
      ctx.auth.getUserOrFail()
    )
    return updated(order, `Pedido #${order.number} cancelado`)
  }

  async requestCancel(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const orderId = await uuidValidator.validate(ctx.params.orderId)
    const { reason } = await ctx.request.validateUsing(cancelRequestValidator)
    const order = await this.partnerOrders.requestCancel(
      storeId,
      partner,
      orderId,
      reason,
      ctx.auth.getUserOrFail()
    )
    return updated(order, 'Cancelamento solicitado. Um gerente vai responder.')
  }

  async deliver(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const orderId = await uuidValidator.validate(ctx.params.orderId)
    const order = await this.partnerOrders.deliver(
      storeId,
      partner,
      orderId,
      ctx.auth.getUserOrFail()
    )
    return updated(order, `Pedido #${order.number} entregue ao cliente`)
  }

  async commissions(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    return ok(await this.commission.overview(storeId, partner))
  }

  private async partner({ params, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return { storeId, partner: await this.partners.forMember(storeId, auth.getUserOrFail()) }
  }
}
