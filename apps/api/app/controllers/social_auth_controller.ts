import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import User from '#models/user'
import UserSocialAccount from '#models/user_social_account'
import env from '#start/env'
import { inject } from '@adonisjs/core'
import AuthService from '#services/auth_service'
import AppException from '#exceptions/app_exception'
import { ok } from '#helpers/api_response'
import { enabledSocialProviders, isEnabledSocialProvider } from '#helpers/social_providers'
import { UserStatusEnum } from '#enums/user_status'
import { DateTime } from 'luxon'
import { GoogleDriver } from '@adonisjs/ally/drivers/google'
import { TwitterDriver } from '@adonisjs/ally/drivers/twitter'
import { FacebookDriver } from '@adonisjs/ally/drivers/facebook'

/**
 * Sign in with a social account (popup flow, see apps/web app/app/(auth)/social).
 * Only links to existing accounts: staff are added by a manager first, and
 * the provider's e-mail must be verified.
 */
@inject()
export default class SocialAuthController {
  constructor(private authService: AuthService) {}

  /** The providers configured on this server (the login page shows their buttons). */
  async providers() {
    return ok({ providers: enabledSocialProviders() })
  }

  async redirect({ params, ally }: HttpContext) {
    const provider = this.provider(params.provider)
    const url = await ally.use(provider).redirectUrl()

    return ok({ provider, url })
  }

  async callback({ params, auth, response, ally }: HttpContext) {
    const provider = this.provider(params.provider)

    function redirect(message?: string) {
      const query = message ? `?error=${encodeURIComponent(message)}` : ''
      return response.redirect(`${env.get('FRONTEND_URL')}/app/social${query}`)
    }

    try {
      const driver = ally.use(provider)

      const validationError = this.validateDriver(driver)
      if (validationError) return redirect(validationError)

      const socialUser = await driver.user()

      if (!socialUser.email) {
        return redirect('O provedor não retornou um e-mail.')
      }
      // Anyone can put an unconfirmed address on some providers' accounts.
      if (socialUser.emailVerificationState === 'unverified') {
        return redirect('Confirme seu e-mail na conta do provedor e tente de novo.')
      }

      const user = await User.query().whereILike('email', socialUser.email).first()

      if (!user) {
        return redirect(
          'Não há acesso ao painel para este e-mail. Peça à gerência da loja para adicionar você à equipe.'
        )
      }
      if (user.status !== UserStatusEnum.ACTIVE) {
        return redirect('Esta conta está desativada. Fale com a gerência da loja.')
      }

      await this.saveOrUpdateSocialAccount(provider, socialUser, user.id)
      await this.authService.createSession(user, { response, auth })

      return redirect()
    } catch (error) {
      logger.error({ err: error, provider }, 'social login failed')
      return redirect('Não foi possível entrar agora. Tente de novo.')
    }
  }

  private provider(value: string) {
    if (!isEnabledSocialProvider(value)) {
      throw new AppException('Login social indisponível.', 404, 'E_SOCIAL_PROVIDER_DISABLED')
    }
    return value
  }

  private validateDriver(driver: GoogleDriver | TwitterDriver | FacebookDriver): string | null {
    if (driver.accessDenied()) {
      return 'Você cancelou o login.'
    }

    if (driver.stateMisMatch()) {
      return 'O login expirou. Tente de novo.'
    }

    if (driver.hasError()) {
      return driver.getError() || 'O provedor recusou o login.'
    }

    return null
  }

  private async saveOrUpdateSocialAccount(
    provider: string,
    socialUser: Awaited<
      | ReturnType<GoogleDriver['user']>
      | ReturnType<TwitterDriver['user']>
      | ReturnType<FacebookDriver['user']>
    >,
    userId: string
  ): Promise<void> {
    const expiresAt =
      'expiresIn' in socialUser.token && socialUser.token.expiresIn
        ? DateTime.fromMillis(Date.now() + socialUser.token.expiresIn * 1000)
        : null

    const refreshToken = 'refreshToken' in socialUser.token ? socialUser.token.refreshToken : null

    const socialAccount = await UserSocialAccount.firstOrCreate(
      {
        provider: provider,
        providerUserId: socialUser.id,
      },
      {
        userId: userId,
        accessToken: socialUser.token.token,
        refreshToken: refreshToken,
        expiresAt: expiresAt,
      }
    )

    socialAccount.merge({
      accessToken: socialUser.token.token,
      refreshToken,
      expiresAt,
    })

    await socialAccount.save()
  }
}
