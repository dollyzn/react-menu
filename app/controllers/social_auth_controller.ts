import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserSocialAccount from '#models/user_social_account'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { DateTime } from 'luxon'
import { GoogleDriver } from '@adonisjs/ally/drivers/google'
import { TwitterDriver } from '@adonisjs/ally/drivers/twitter'
import { FacebookDriver } from '@adonisjs/ally/drivers/facebook'

export default class SocialAuthController {
  private sendCookie = env.get('AUTH_COOKIE_ENABLED', false)
  private cookieName = env.get('AUTH_COOKIE_NAME')

  async redirect({ params, ally }: HttpContext) {
    const provider = params.provider as 'google' | 'twitter' | 'facebook'

    const driver = ally.use(provider)
    const url = await driver.redirectUrl()

    return {
      success: true,
      provider,
      url,
    }
  }

  async callback({ params, auth, response, ally }: HttpContext) {
    const provider = params.provider as 'google' | 'twitter' | 'facebook'
    const frontendUrl = env.get('FRONTEND_URL')

    function redirect(message?: string) {
      return response.redirect(
        `${frontendUrl}/auth/social?${message ? 'error=' + encodeURIComponent(message) : ''}`
      )
    }

    try {
      const driver = ally.use(provider)

      const validationError = this.validateDriver(driver)

      if (validationError) {
        return redirect(validationError)
      }

      const socialUser = await driver.user()

      if (!socialUser.email) {
        return redirect('O provedor não retornou um email válido.')
      }

      const user = await User.findBy('email', socialUser.email)

      if (!user) {
        return redirect('Esta conta não foi encontrada no sistema. Procure a equipe responsável.')
      }

      await this.saveOrUpdateSocialAccount(provider, socialUser, user.id)

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

      return redirect()
    } catch (error) {
      return redirect('Erro desconhecido ao processar autenticação.')
    }
  }

  private validateDriver(driver: GoogleDriver | TwitterDriver | FacebookDriver): string | null {
    if (driver.accessDenied()) {
      return 'Você cancelou o processo de login'
    }

    if (driver.stateMisMatch()) {
      return 'Falha na validação do login. Tente novamente.'
    }

    if (driver.hasError()) {
      return driver.getError() || 'Erro ao autenticar com o provedor.'
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
