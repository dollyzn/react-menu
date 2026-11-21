/**
 * Channel authorization for Transmit. Every channel must be authorized here;
 * the Transmit routes themselves only require an authenticated user.
 */
import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { uuidValidator } from '#validators/common'
import StoreRole from '#enums/store_role'

transmit.authorize<{ id: string }>('stores/:id', async (ctx: HttpContext, { id }) => {
  const [error, storeId] = await uuidValidator.tryValidate(id)
  if (error || !ctx.auth.user) return false

  // Partners follow only their own channel below (ADR 0024).
  const role = await ctx.auth.user.storeRole(storeId)
  return role !== null && role !== StoreRole.PARTNER
})

/**
 * A partner's orders (ADR 0024): the partner's people, and the store's
 * managers (who look at the partner's screens).
 */
transmit.authorize<{ id: string; partnerId: string }>(
  'stores/:id/partners/:partnerId',
  async (ctx: HttpContext, { id, partnerId }) => {
    const [storeError, storeId] = await uuidValidator.tryValidate(id)
    const [partnerError] = await uuidValidator.tryValidate(partnerId)
    if (storeError || partnerError || !ctx.auth.user) return false

    const membership = await ctx.auth.user.storeMembership(storeId)
    if (!membership) return false
    return membership.role === StoreRole.MANAGER || membership.partnerId === partnerId
  }
)

transmit.authorize<{ id: string }>('users/:id/notifications', (ctx: HttpContext, { id }) => {
  return ctx.auth.user?.id === id
})

/**
 * Customer order tracking. The token is an unguessable UUID that only the
 * customer received, so knowing it is the authorization (no login needed).
 */
transmit.authorize<{ token: string }>('orders/:token', async (_ctx: HttpContext, { token }) => {
  const [error] = await uuidValidator.tryValidate(token)
  return !error
})
