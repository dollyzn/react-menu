/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| You may export multiple abilities from this file and pre-register them
| when creating the Bouncer instance.
|
| Pre-registered policies and abilities can be referenced as a string by their
| name. Also they are must if want to perform authorization inside Edge
| templates.
|
*/

import { Bouncer } from '@adonisjs/bouncer'
import type User from '#models/user'

/**
 * Tenant boundary: a user may only operate on stores they are linked to
 * (store_user), unless they are a super user.
 */
export const accessStore = Bouncer.ability(async (user: User, storeId: string) => {
  return await user.hasStoreAccess(storeId)
})
