/**
 * Channel authorization for Transmit. Every channel must be authorized here;
 * the Transmit routes themselves only require an authenticated user.
 */
import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import { uuidValidator } from '#validators/common'

transmit.authorize<{ id: string }>('stores/:id', async (ctx: HttpContext, { id }) => {
  const [error, storeId] = await uuidValidator.tryValidate(id)
  if (error || !ctx.auth.user) return false

  return await ctx.auth.user.hasStoreAccess(storeId)
})

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
