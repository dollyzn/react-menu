import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { created, ok, updated } from '#helpers/api_response'
import PartnerService from '#services/partner_service'
import PartnerCommissionService from '#services/partner_commission_service'
import {
  parsePagination,
  parseSort,
  pickQueryFilters,
  wantsFacets,
} from '#helpers/query_string_parser'
import { storeExistValidator, uuidValidator } from '#validators/common'
import {
  partnerCatalogValidator,
  partnerPauseValidator,
  partnerValidator,
} from '#validators/partner'

/** The store's partners (ADR 0024; managers only, see routes). */
@inject()
export default class PartnersController {
  constructor(
    private partners: PartnerService,
    private commissions: PartnerCommissionService
  ) {}

  /**
   * Without `page`: every partner (pickers: the invite, the machines).
   * With it: the managers' table, with the period's (`createdAt=from~to`)
   * sales and what is to pay, sortable and filtered by name and status.
   */
  async index({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const q = request.qs()
    if (!q.page) return ok(await this.partners.list(storeId))

    const options = {
      ...parsePagination(q),
      sort: parseSort(q, {
        name: 'p.name',
        sales: 'per.sales',
        commission: 'per.commission',
        toPay: 'due.amount',
      }),
      filters: pickQueryFilters(q, ['name', 'status', 'createdAt']),
    }
    const page = await this.commissions.table(storeId, options)
    const facets = wantsFacets(q)
      ? { status: await this.commissions.statusCounts(storeId, options) }
      : undefined
    return ok(page.data, { ...page.meta, facets })
  }

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    return ok(await this.partners.show(storeId, partnerId))
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const data = await request.validateUsing(partnerValidator)

    const partner = await this.partners.create(storeId, data)

    return created(await this.partners.show(storeId, partner.id), 'Parceiro criado')
  }

  async update({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    const data = await request.validateUsing(partnerValidator)

    const partner = await this.partners.update(storeId, partnerId, data, auth.getUserOrFail())

    return updated(partner, 'Parceiro atualizado')
  }

  async pause({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    const { paused } = await request.validateUsing(partnerPauseValidator)

    const partner = await this.partners.setPaused(storeId, partnerId, paused)

    return updated(partner, paused ? 'Parceiro pausado' : 'Parceiro reativado')
  }

  async catalog({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const partnerId = await uuidValidator.validate(params.partnerId)
    const data = await request.validateUsing(partnerCatalogValidator)

    const partner = await this.partners.setCatalog(storeId, partnerId, data)

    return updated(partner, 'Cardápio do parceiro atualizado')
  }
}
