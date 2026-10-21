import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { forgotPasswordValidator, loginValidator, resetPasswordValidator } from '#validators/auth'
import AuthService from '#services/auth_service'
import PasswordResetService from '#services/password_reset_service'
import { messageOnly, ok } from '#helpers/api_response'

@inject()
export default class AuthController {
  constructor(
    private authService: AuthService,
    private passwordResets: PasswordResetService
  ) {}

  async login({ request, response, auth }: HttpContext) {
    const data = await request.validateUsing(loginValidator)

    const result = await this.authService.login(data, { request, response, auth })

    return ok(result)
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

  async me({ auth, response }: HttpContext) {
    const user = await this.authService.me(auth.getUserOrFail(), { auth, response })

    return ok({ user })
  }
}
