import type { HttpContext } from '@adonisjs/core/http'
import { loginValidator, registerValidator } from '#validators/auth'
import app from '@adonisjs/core/services/app'
import User from '#models/user'
import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'
import AppException from '#exceptions/app_exception'

export default class AuthController {
  private sendCookie = env.get('AUTH_COOKIE_ENABLED', false)
  private cookieName = env.get('AUTH_COOKIE_NAME')

  async register({ request, response }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    const user = await User.create(data)
    const token = (await User.accessTokens.create(user)).toJSON()

    if (this.sendCookie) {
      response.cookie(this.cookieName, token.token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: app.inProduction,
        expires: new Date(2147483647 * 1000),
        maxAge: undefined,
      })
    }

    return user
  }

  async login({ request, response, auth }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const loginLimiter = limiter.use({
      requests: 5,
      duration: '1 min',
      blockDuration: '5 min',
    })

    const key = `login_${request.ip()}_${email}`

    const [error, user] = await loginLimiter.penalize(key, () =>
      User.verifyCredentials(email, password)
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

    const token = (await auth.use('api').createToken(user)).toJSON()

    await user.load((loader) => loader.preload('role', (query) => query.preload('permissions')))

    if (this.sendCookie) {
      response.cookie(this.cookieName, token.token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: app.inProduction,
        expires: new Date(2147483647 * 1000),
        maxAge: undefined,
      })
    }

    return {
      success: true,
      user: {
        ...user.toJSON(),
        tokenExpiresAt: token.expiresAt,
      },
    }
  }

  async logout({ auth, response }: HttpContext) {
    const result = await auth.use('api').invalidateToken()

    response.cookie(this.cookieName, '', {
      httpOnly: true,
      sameSite: 'strict',
      secure: app.inProduction,
      expires: new Date(0),
      maxAge: undefined,
    })

    return {
      success: result,
      message: result
        ? 'Você foi deslogado com sucesso.'
        : 'Ocorreu um erro ao tentar fazer logout.',
    }
  }

  async me({ auth }: HttpContext) {
    await auth.check()

    const user = auth.user

    if (!user) {
      return {
        success: false,
      }
    }

    await user.load((loader) => loader.preload('role', (query) => query.preload('permissions')))

    const serializedUser = {
      ...user.toJSON(),
      tokenExpiresAt: user.currentAccessToken?.toJSON().expiresAt,
    }

    return {
      success: true,
      user: serializedUser,
    }
  }
}
