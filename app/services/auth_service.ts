import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import User from '#models/user'
import env from '#start/env'
import AppException from '#exceptions/app_exception'

type RegisterPayload = {
  name: string
  email: string
  password: string
}

type LoginPayload = {
  email: string
  password: string
}

export default class AuthService {
  private sendCookie = env.get('AUTH_COOKIE_ENABLED', false)
  private cookieName = env.get('AUTH_COOKIE_NAME')

  private setAuthCookie(response: HttpContext['response'], token: string) {
    if (!this.sendCookie) return
    response.cookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: app.inProduction,
      expires: new Date(2147483647 * 1000),
      maxAge: undefined,
    })
  }

  private clearAuthCookie(response: HttpContext['response']) {
    response.cookie(this.cookieName, '', {
      httpOnly: true,
      sameSite: 'strict',
      secure: app.inProduction,
      expires: new Date(0),
      maxAge: undefined,
    })
  }

  async register(data: RegisterPayload, response: HttpContext['response']) {
    const user = await User.create(data)
    const token = await User.accessTokens.create(user)

    const serializedToken = token.toJSON()

    if (serializedToken.token) {
      this.setAuthCookie(response, serializedToken.token)
    }

    return {
      user,
      tokenExpiresAt: serializedToken.expiresAt,
    }
  }

  async login(data: LoginPayload, ctx: Pick<HttpContext, 'request' | 'response' | 'auth'>) {
    const { request, response, auth } = ctx

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

    const accessToken = await auth.use('api').createToken(user)

    const serializedToken = accessToken.toJSON()

    await user.load((loader) => loader.preload('role', (query) => query.preload('permissions')))

    if (serializedToken.token) {
      this.setAuthCookie(response, serializedToken.token)
    }

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

  async me(auth: HttpContext['auth']) {
    await auth.check()
    const user = auth.user

    if (!user) {
      return null
    }

    await user.load((loader) => loader.preload('role', (query) => query.preload('permissions')))

    return {
      ...user.toJSON(),
      tokenExpiresAt: user.currentAccessToken?.toJSON().expiresAt,
    }
  }
}
