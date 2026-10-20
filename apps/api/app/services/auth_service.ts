import type { HttpContext } from '@adonisjs/core/http'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import User, { SESSION_TTL } from '#models/user'
import env from '#start/env'
import AppException from '#exceptions/app_exception'

type LoginPayload = {
  email: string
  password: string
}

export default class AuthService {
  private sendCookie = env.get('AUTH_COOKIE_ENABLED', false)
  private cookieName = env.get('AUTH_COOKIE_NAME')

  /**
   * Issues an access token for the user and, when enabled, stores it in an
   * httpOnly cookie that expires together with the token.
   */
  async createSession(user: User, ctx: Pick<HttpContext, 'response' | 'auth'>) {
    const accessToken = await ctx.auth.use('api').createToken(user)
    const serializedToken = accessToken.toJSON()

    if (this.sendCookie && serializedToken.token) {
      ctx.response.cookie(this.cookieName, serializedToken.token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: app.inProduction,
        maxAge: SESSION_TTL,
      })
    }

    return serializedToken
  }

  private clearAuthCookie(response: HttpContext['response']) {
    response.clearCookie(this.cookieName)
  }

  async login(data: LoginPayload, ctx: Pick<HttpContext, 'request' | 'response' | 'auth'>) {
    const { request } = ctx

    const loginLimiter = limiter.use({
      requests: 5,
      duration: '1 min',
      blockDuration: '5 min',
    })

    const key = `login_${request.ip()}_${data.email}`

    const [error, user] = await loginLimiter.penalize(key, () =>
      User.verifyCredentials(data.email, data.password)
    )

    if (error) {
      throw new AppException(
        `Muitas tentativas de login. Tente novamente após ${
          error.response.availableIn > 60
            ? Math.floor(error.response.availableIn / 60) + ' minutos'
            : error.response.availableIn + ' segundos'
        }`,
        429
      )
    }

    const serializedToken = await this.createSession(user, ctx)

    await user.load((loader) =>
      loader.preload('stores').preload('role', (query) => query.preload('permissions'))
    )

    return {
      user: {
        ...user.toJSON(),
        tokenExpiresAt: serializedToken.expiresAt,
      },
    }
  }

  async logout(response: HttpContext['response'], auth: HttpContext['auth']) {
    const result = await auth.use('api').invalidateToken()
    this.clearAuthCookie(response)
    return result
  }

  async me(user: User & { currentAccessToken?: AccessToken }) {
    await user.load((loader) =>
      loader.preload('stores').preload('role', (query) => query.preload('permissions'))
    )

    return {
      ...user.toJSON(),
      tokenExpiresAt: user.currentAccessToken?.toJSON().expiresAt,
    }
  }
}
