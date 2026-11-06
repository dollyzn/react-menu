import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { setAttributes } from '@adonisjs/otel/helpers'
import { uuidValidator } from '#validators/common'

/**
 * Guards every `/stores/:storeId/*` route. Must run after the auth middleware.
 */
export default class StoreAccessMiddleware {
  async handle({ params, bouncer }: HttpContext, next: NextFn) {
    const storeId = await uuidValidator.validate(params.storeId)

    await bouncer.authorize('accessStore', storeId)
    // Filter traces by store in Grafana (`store.id`; a no-op without OpenTelemetry).
    setAttributes({ 'store.id': storeId })

    return next()
  }
}
