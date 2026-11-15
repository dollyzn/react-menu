import type { HttpContext } from '@adonisjs/core/http'
import { touchLastSeen } from '#helpers/user_activity'
import { inject } from '@adonisjs/core'
import {
  forgotPasswordValidator,
  loginValidator,
  resetPasswordValidator,
  twoFactorValidator,
} from '#validators/auth'
import TwoFactorService from '#services/two_factor_service'
import AuthService from '#services/auth_service'
import PasswordResetService from '#services/password_reset_service'
import { messageOnly, noStore, ok } from '#helpers/api_response'

@inject()
export default class AuthController {
  constructor(
    private authService: AuthService,
    private passwordResets: PasswordResetService,
    private twoFactor: TwoFactorService
  ) {}

  async login({ request, response, auth }: HttpContext) {
    const data = await request.validateUsing(loginValidator)
    // Sets cookies (challenge or session): a replay of the body alone would lose them.
    noStore(response)

    const result = await this.authService.login(data, { request, response, auth })

    return ok(result)
  }

  /**
   * The sign-in waiting for its code (cookie). `?ifAny=1`: the login page asks
   * on its own, because Google may have finished somewhere it can't hear
   * (the installed app reopens on its start page after the browser tab): none
   * waiting (or one locked by wrong codes) is then `null`, not an error.
   */
  async twoFactorChallenge({ request, response }: HttpContext) {
    const ctx = { request, response }
    return ok({
      twoFactor:
        request.input('ifAny') === '1'
          ? await this.twoFactor.pending(ctx)
          : await this.twoFactor.current(ctx),
    })
  }

  async verifyTwoFactor({ request, response, auth }: HttpContext) {
    const data = await request.validateUsing(twoFactorValidator)
    noStore(response)
    return ok(await this.authService.completeTwoFactor(data, { request, response, auth }))
  }

  async resendTwoFactor({ request, response }: HttpContext) {
    return ok({ twoFactor: await this.twoFactor.resend({ request, response }) })
  }

  async logout({ auth, response }: HttpContext) {
    await this.authService.logout(response, auth)

    return messageOnly('Você foi deslogado com sucesso.')
  }

  /** Same answer whether or not the e-mail has an account. */
  async forgotPassword({ request }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    await this.passwordResets.request(email, request.ip())

    return messageOnly(
      'Se houver uma conta com este e-mail, enviamos um link para redefinir a senha.'
    )
  }

  async resetPassword({ request }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)

    await this.passwordResets.reset(token, password)

    return messageOnly('Senha redefinida. Entre com a nova senha.')
  }

  async me({ auth, request, response }: HttpContext) {
    const signedIn = auth.getUserOrFail()
    const user = await this.authService.me(signedIn, { auth, request, response })
    // The panel loading counts as activity ("online" on the team page).
    await touchLastSeen(signedIn.id)

    return ok({ user })
  }
}
