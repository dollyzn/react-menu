import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { loginValidator } from '#validators/auth'
import AuthService from '#services/auth_service'
import { fail, messageOnly, ok } from '#helpers/api_response'

@inject()
export default class AuthController {
  constructor(private authService: AuthService) {}

  async login({ request, response, auth }: HttpContext) {
    const data = await request.validateUsing(loginValidator)

    const result = await this.authService.login(data, { request, response, auth })

    return ok(result)
  }

  async logout({ auth, response }: HttpContext) {
    const result = await this.authService.logout(response, auth)

    if (!result) {
      return fail('Ocorreu um erro ao tentar fazer logout.')
    }

    return messageOnly('Você foi deslogado com sucesso.')
  }

  async me({ auth }: HttpContext) {
    const user = await this.authService.me(auth)

    if (!user) {
      return fail('Não autenticado')
    }

    return ok({ user })
  }
}
