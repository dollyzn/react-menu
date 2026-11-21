import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { setAttributes } from '@adonisjs/otel/helpers'
import StoreRole from '#enums/store_role'
import AppException from '#exceptions/app_exception'
import { uuidValidator } from '#validators/common'

/** The partner area (ADR 0024): the only store routes a partner reaches. */
const PARTNER_AREA = /\/stores\/:storeId\/partner(\/|$)/

export function isPartnerArea(pattern: string | undefined) {
  return Boolean(pattern && PARTNER_AREA.test(pattern))
}

/**
 * Guards every `/stores/:storeId/*` route. Must run after the auth middleware.
 *
 * Partners are refused everywhere outside the partner area, so a store route
 * without a role guard never shows them the store's orders, customers or
 * reports; and only partners use the partner area.
 */
export default class StoreAccessMiddleware {
  async handle({ params, bouncer, auth, route }: HttpContext, next: NextFn) {
    const storeId = await uuidValidator.validate(params.storeId)

    await bouncer.authorize('accessStore', storeId)

    const partnerArea = isPartnerArea(route?.pattern)
    const role = await auth.getUserOrFail().storeRole(storeId)
    if ((role === StoreRole.PARTNER) !== partnerArea) {
      throw new AppException(
        partnerArea
          ? 'Esta área é só para parceiros.'
          : 'Parceiros usam a área de parceiro do painel.',
        403,
        'E_PARTNER_AREA'
      )
    }

    // Filter traces by store in Grafana (`store.id`; a no-op without OpenTelemetry).
    setAttributes({ 'store.id': storeId })

    return next()
  }
}
