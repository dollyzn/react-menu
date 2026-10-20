import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Identifies the user when a valid session exists, without rejecting guests.
 * Used where authorization is decided later (e.g. per realtime channel).
 */
export default class SilentAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    await ctx.auth.check()
    return next()
  }
}
