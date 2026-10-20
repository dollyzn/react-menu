import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { uuidValidator } from '#validators/common'

/**
 * Guards every `/stores/:storeId/*` route. Must run after the auth middleware.
 */
export default class StoreAccessMiddleware {
  async handle({ params, bouncer }: HttpContext, next: NextFn) {
    const storeId = await uuidValidator.validate(params.storeId)

    await bouncer.authorize('accessStore', storeId)

    return next()
  }
}
