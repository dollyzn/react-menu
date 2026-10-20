import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { UserStatusEnum } from '#enums/user_status'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards)

    const user = ctx.auth.user

    if (!user) {
      return ctx.response.unauthorized({
        success: false,
        error: 'Usuário não autenticado',
        code: 'E_UNAUTHORIZED_ACCESS',
      })
    }

    // Verificar se o usuário está ativo
    if (user.status !== UserStatusEnum.ACTIVE) {
      return ctx.response.forbidden({
        success: false,
        error: 'Sua conta está inativa. Entre em contato com o administrador.',
        code: 'E_USER_INACTIVE',
      })
    }

    return next()
  }
}
