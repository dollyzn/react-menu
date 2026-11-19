import StoreRole from '#enums/store_role'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

export const authThrottle = [middleware.auth(), throttle]

/** Catalog, inventory and store settings changes, opening/closing the store included. */
export const managersOnly = middleware.storeRole({ roles: [StoreRole.MANAGER] })

/** Front-of-house operations (POS, the orders board). */
export const frontOfHouse = middleware.storeRole({
  roles: [StoreRole.MANAGER, StoreRole.ATTENDANT],
})

/** The kitchen display (attendants work the counter, not the line). */
export const kitchenStaff = middleware.storeRole({
  roles: [StoreRole.MANAGER, StoreRole.KITCHEN],
})
