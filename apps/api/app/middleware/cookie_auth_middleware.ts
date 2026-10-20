import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Lets the tokens guard read the access token from the httpOnly auth cookie.
 * An explicit Authorization header always takes precedence.
 */
export default class CookieAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (env.get('AUTH_COOKIE_ENABLED') && !ctx.request.header('authorization')) {
      const token = ctx.request.cookie(env.get('AUTH_COOKIE_NAME'))

      if (token) {
        ctx.request.request.headers['authorization'] = `Bearer ${token}`
      }
    }

    return next()
  }
}
