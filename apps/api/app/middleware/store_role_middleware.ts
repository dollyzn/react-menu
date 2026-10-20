import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type StoreRole from '#enums/store_role'

/**
 * Restricts a `/stores/:storeId/*` route to some store roles. Must run after
 * `storeAccess` (which validates the store id and membership).
 */
export default class StoreRoleMiddleware {
  async handle({ params, bouncer }: HttpContext, next: NextFn, options: { roles: StoreRole[] }) {
    await bouncer.authorize('hasStoreRole', params.storeId, options.roles)

    return next()
  }
}
