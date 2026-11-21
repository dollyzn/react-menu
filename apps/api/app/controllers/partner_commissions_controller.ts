import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { created, messageOnly, ok } from '#helpers/api_response'
import AppException from '#exceptions/app_exception'
import PartnerCommissionService from '#services/partner_commission_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { partnerPeriodValidator, settlePartnerValidator } from '#validators/partner'
import {
  parsePagination,
  parseSort,
  pickQueryFilters,
  wantsFacets,
} from '#helpers/query_string_parser'

/** Partners' sales, commission and settlements (ADR 0024; managers only). */
@inject()
export default class PartnerCommissionsController {
  constructor(private commissions: PartnerCommissionService) {}

  /** The partner's overview: the period against the one before, day by day. */
  async stats({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    const range = await partnerPeriodValidator.validate(request.qs())
    // In order and up to a year, like the reports (the daily series has a row per day).
    const days = DateTime.fromISO(range.to).diff(DateTime.fromISO(range.from), 'days').days + 1
    if (days < 1 || days > 366) {
      throw new AppException('Escolha um período de até um ano.', 422, 'E_INVALID_PERIOD')
    }
    return ok(await this.commissions.stats(storeId, partnerId, range))
  }

  /** The partner's sales, like the order history (period, commission state, search, sort). */
  async sales({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    const q = request.qs()
    const options = {
      ...parsePagination(q),
      sort: parseSort(q, {
        createdAt: 'o.created_at',
        total: 'o.total',
        commissionAmount: 'o.commission_amount',
      }),
      filters: pickQueryFilters(q, ['createdAt', 'settlement', 'customerName']),
    }
    const { rows, meta } = await this.commissions.sales(storeId, partnerId, options)
    const facets = wantsFacets(q)
      ? await this.commissions.salesFacets(storeId, partnerId, options.filters)
      : undefined
    return ok(rows, { ...meta, facets })
  }

  async settlements({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    return ok(await this.commissions.settlements(storeId, partnerId))
  }

  async settle({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    const input = await request.validateUsing(settlePartnerValidator)
    const settlement = await this.commissions.settle(
      storeId,
      partnerId,
      input,
      auth.getUserOrFail()
    )
    return created(
      settlement,
      `Comissão de ${settlement.ordersCount} ${settlement.ordersCount === 1 ? 'pedido marcada' : 'pedidos marcada'} como paga`
    )
  }

  async undo({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    const settlementId = await uuidValidator.validate(params.settlementId)
    await this.commissions.undo(storeId, partnerId, settlementId)
    return messageOnly('Acerto desfeito: os pedidos voltaram para "a pagar"')
  }
}
