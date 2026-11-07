import env from '#start/env'
import { cookieWriteAllowed } from '#helpers/trusted_origin'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Lets the tokens guard read the access token from the httpOnly auth cookie.
 * An explicit Authorization header always takes precedence. Writes that
 * carry the cookie must come from the panel's origin (#helpers/trusted_origin).
 */
export default class CookieAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (env.get('AUTH_COOKIE_ENABLED') && !ctx.request.header('authorization')) {
      const token = ctx.request.cookie(env.get('AUTH_COOKIE_NAME'))

      if (token) {
        // A write with the cookie from another origin (CSRF): refused.
        const allowed = cookieWriteAllowed({
          method: ctx.request.method(),
          origin: ctx.request.header('origin'),
          fetchSite: ctx.request.header('sec-fetch-site'),
        })
        if (!allowed) {
          return ctx.response.forbidden({
            success: false,
            error: 'Requisição de outra origem recusada.',
            code: 'E_UNTRUSTED_ORIGIN',
          })
        }
        ctx.request.request.headers['authorization'] = `Bearer ${token}`
      }
    }

    return next()
  }
}
