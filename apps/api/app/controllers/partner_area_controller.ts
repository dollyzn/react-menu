import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { created, ok, updated } from '#helpers/api_response'
import AppException from '#exceptions/app_exception'
import PartnerMemberRole from '#enums/partner_member_role'
import PartnerCommissionService from '#services/partner_commission_service'
import PartnerOrderService from '#services/partner_order_service'
import PartnerService from '#services/partner_service'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { partnerOrderValidator } from '#validators/order'
import { cancelRequestValidator, partnerOrdersValidator } from '#validators/partner'

/** The partner's managers see the commission; its attendants only sell. */
const sees = (role?: PartnerMemberRole) => role === PartnerMemberRole.MANAGER

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** In the partner area: the signed-in person's role inside the partner. */
    partnerRole?: PartnerMemberRole
  }
}

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
    const { storeId, partner, role } = await this.partner(ctx)
    const context = await this.partnerOrders.context(storeId, partner)
    return ok({
      ...context,
      partner: { ...context.partner, commission: sees(role) ? context.partner.commission : null },
      me: { role },
    })
  }

  async menu(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    return ok(await this.partnerOrders.menu(storeId, partner))
  }

  async orders(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const { date } = await partnerOrdersValidator.validate(ctx.request.qs())
    const orders = await this.partnerOrders.list(storeId, partner, {
      date: date ? DateTime.fromISO(date, { zone: BUSINESS_TIMEZONE }) : undefined,
    })
    return ok(orders.map((order) => this.forRole(ctx, order)))
  }

  async show(ctx: HttpContext) {
    const { storeId, partner } = await this.partner(ctx)
    const orderId = await uuidValidator.validate(ctx.params.orderId)
    return ok(this.forRole(ctx, await this.partnerOrders.show(storeId, partner, orderId)))
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
    return created(this.forRole(ctx, order), `Pedido #${order.number} criado. Cobre na maquininha.`)
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
    return updated(this.forRole(ctx, order), `Pedido #${order.number} cancelado`)
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
    return updated(this.forRole(ctx, order), 'Cancelamento solicitado. Um gerente vai responder.')
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
    return updated(this.forRole(ctx, order), `Pedido #${order.number} entregue ao cliente`)
  }

  /** The partner's managers only: an attendant of the partner sells, without the commission. */
  async commissions(ctx: HttpContext) {
    const { storeId, partner, role } = await this.partner(ctx)
    if (!sees(role)) {
      throw new AppException(
        'A comissão é só para quem gerencia o parceiro.',
        403,
        'E_PARTNER_MANAGERS_ONLY'
      )
    }
    return ok(await this.commission.overview(storeId, partner))
  }

  private async partner(ctx: HttpContext) {
    const storeId = await storeExistValidator.validate(ctx.params.storeId)
    const { partner, role } = await this.partners.memberOf(storeId, ctx.auth.getUserOrFail())
    ctx.partnerRole = role
    return { storeId, partner, role }
  }

  /** An order as this person sees it: an attendant of the partner doesn't see the commission. */
  private forRole<Order extends { commissionAmount: number | null }>(
    ctx: HttpContext,
    order: Order
  ) {
    return sees(ctx.partnerRole) ? order : { ...order, commissionAmount: null }
  }
}
