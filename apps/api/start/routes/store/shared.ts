import StoreRole from '#enums/store_role'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

export const authThrottle = [middleware.auth(), throttle]

/** Catalog, inventory and store settings changes. */
export const managersOnly = middleware.storeRole({ roles: [StoreRole.MANAGER] })

/** Front-of-house operations (POS, opening/closing the store). */
export const frontOfHouse = middleware.storeRole({
  roles: [StoreRole.MANAGER, StoreRole.ATTENDANT],
})
