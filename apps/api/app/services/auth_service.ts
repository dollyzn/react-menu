import type { HttpContext } from '@adonisjs/core/http'
import type { AccessToken } from '@adonisjs/auth/access_tokens'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import string from '@adonisjs/core/helpers/string'
import User, { SESSION_TTL } from '#models/user'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import { inject } from '@adonisjs/core'
import TwoFactorService from '#services/two_factor_service'
import AppException from '#exceptions/app_exception'
import StoreRole from '#enums/store_role'

type LoginPayload = {
  email: string
  password: string
}

@inject()
export default class AuthService {
  constructor(private twoFactor: TwoFactorService) {}

  private sendCookie = env.get('AUTH_COOKIE_ENABLED', false)
  private cookieName = env.get('AUTH_COOKIE_NAME')

  /**
   * Issues an access token for the user and, when enabled, stores it in an
   * httpOnly cookie that expires together with the token.
   */
  async createSession(
    user: User,
    ctx: Pick<HttpContext, 'request' | 'response' | 'auth'>,
    options: { signedInAt?: Date | null; trustedDeviceId?: string | null } = {}
  ) {
    if (user.invitePending) {
      user.invitePending = false
      await user.save()
    }
    const accessToken = await ctx.auth.use('api').createToken(user)
    const serializedToken = accessToken.toJSON()
    // For "Sessões ativas": where it came from, and since when (a renewal
    // keeps the original sign-in time).
    await db
      .from('auth_access_tokens')
      .where('id', String(accessToken.identifier))
      .update({
        user_agent: ctx.request.header('user-agent')?.slice(0, 512) ?? null,
        ip_address: ctx.request.ip(),
        signed_in_at: options.signedInAt ?? new Date(),
        // Ending this session ends the trust it was opened with.
        trusted_device_id: options.trustedDeviceId ?? null,
      })

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

    return await this.afterFirstFactor(user, ctx)
  }

  /**
   * Password (or Google) passed: a trusted device signs in now, anything else
   * gets the second step (`twoFactor`: an e-mail code or the authenticator).
   */
  async afterFirstFactor(user: User, ctx: Pick<HttpContext, 'request' | 'response' | 'auth'>) {
    const next = await this.twoFactor.start(user, ctx)
    if ('challenge' in next) return { twoFactor: next.challenge }
    const serializedToken = await this.createSession(user, ctx, {
      trustedDeviceId: next.trustedDeviceId,
    })
    return { user: await this.sessionUser(user, serializedToken.expiresAt) }
  }

  /** The second step: the code is right, the session starts. */
  async completeTwoFactor(
    input: { code: string; recovery?: boolean; remember?: boolean },
    ctx: Pick<HttpContext, 'request' | 'response' | 'auth'>
  ) {
    const { user, trustedDeviceId } = await this.twoFactor.verify(ctx, input)
    const serializedToken = await this.createSession(user, ctx, { trustedDeviceId })
    return { user: await this.sessionUser(user, serializedToken.expiresAt) }
  }

  async logout(response: HttpContext['response'], auth: HttpContext['auth']) {
    const result = await auth.use('api').invalidateToken()
    this.clearAuthCookie(response)
    return result
  }

  /**
   * The current session. Sliding renewal: when less than half of the session
   * is left, a fresh token replaces it (new cookie, old token deleted), so
   * people who use the panel regularly never get logged out, while an
   * abandoned session still expires.
   */
  async me(
    user: User & { currentAccessToken?: AccessToken },
    ctx: Pick<HttpContext, 'request' | 'response' | 'auth'>
  ) {
    const current = user.currentAccessToken
    const expiresAt = current?.expiresAt
    if (this.sendCookie && current && expiresAt && this.shouldRenew(expiresAt)) {
      const row = await db
        .from('auth_access_tokens')
        .where('id', String(current.identifier))
        .select('signed_in_at', 'trusted_device_id')
        .first()
      const renewed = await this.createSession(user, ctx, {
        signedInAt: row?.signed_in_at,
        trustedDeviceId: row?.trusted_device_id,
      })
      await User.accessTokens.delete(user, current.identifier)
      return await this.sessionUser(user, renewed.expiresAt)
    }
    return await this.sessionUser(user, expiresAt)
  }

  private shouldRenew(expiresAt: Date) {
    return expiresAt.getTime() - Date.now() < string.milliseconds.parse(SESSION_TTL) / 2
  }

  /** SessionUser contract: the user, its permissions, and each store with its role. */
  private async sessionUser(user: User, tokenExpiresAt: Date | null | undefined) {
    await user.load((loader) =>
      loader
        // A store whose managers switched them off disappears from the panel.
        .preload('stores', (query) => query.whereNullPivot('disabled_at'))
        .preload('role', (query) => query.preload('permissions'))
    )

    return {
      ...user.serialize(),
      stores: user.stores.map((store) => ({
        ...store.serialize(),
        role: user.superUser ? StoreRole.MANAGER : store.$extras.pivot_role,
      })),
      tokenExpiresAt: tokenExpiresAt ?? null,
    }
  }
}
