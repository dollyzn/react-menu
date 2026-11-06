import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AccountService from '#services/account_service'
import AuthService from '#services/auth_service'
import TwoFactorService from '#services/two_factor_service'
import { messageOnly, ok, updated } from '#helpers/api_response'
import {
  avatarValidator,
  changePasswordValidator,
  passwordConfirmValidator,
  totpCodeValidator,
  profileValidator,
  sessionIdValidator,
} from '#validators/account'

/** The signed-in user's own account (any role; nothing store-scoped here). */
@inject()
export default class AccountController {
  constructor(
    private account: AccountService,
    private auth: AuthService,
    private twoFactor: TwoFactorService
  ) {}

  /** The id of the token this request came with. */
  private currentId(auth: HttpContext['auth']) {
    const id = auth.getUserOrFail().currentAccessToken?.identifier
    return id === undefined ? undefined : String(id)
  }

  async sessions({ auth }: HttpContext) {
    return ok(await this.account.sessions(auth.getUserOrFail(), this.currentId(auth)))
  }

  async revokeSession({ auth, params }: HttpContext) {
    const id = await sessionIdValidator.validate(Number(params.id))
    await this.account.revokeSession(auth.getUserOrFail(), id, this.currentId(auth))
    return messageOnly('Sessão encerrada')
  }

  async revokeOtherSessions({ auth }: HttpContext) {
    await this.account.revokeOtherSessions(auth.getUserOrFail(), this.currentId(auth))
    return messageOnly('As outras sessões foram encerradas')
  }

  async updateProfile({ auth, request, response }: HttpContext) {
    const data = await request.validateUsing(profileValidator)
    await this.account.updateProfile(auth.getUserOrFail(), data)
    return updated(
      await this.auth.me(auth.getUserOrFail(), { auth, request, response }),
      'Perfil atualizado'
    )
  }

  async setAvatar({ auth, request, response }: HttpContext) {
    const { avatar } = await request.validateUsing(avatarValidator)
    await this.account.setAvatar(auth.getUserOrFail(), avatar)
    return updated(
      await this.auth.me(auth.getUserOrFail(), { auth, request, response }),
      'Foto atualizada'
    )
  }

  async removeAvatar({ auth, request, response }: HttpContext) {
    await this.account.removeAvatar(auth.getUserOrFail())
    return updated(
      await this.auth.me(auth.getUserOrFail(), { auth, request, response }),
      'Foto removida'
    )
  }

  async changePassword({ auth, request }: HttpContext) {
    const data = await request.validateUsing(changePasswordValidator)
    await this.account.changePassword(auth.getUserOrFail(), data, this.currentId(auth))
    return messageOnly('Senha alterada. As outras sessões foram encerradas.')
  }

  /** Second step settings: the authenticator app and its recovery codes. */
  async twoFactorStatus({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    return ok({
      enabled: user.twoFactorEnabled,
      enabledAt: user.twoFactorEnabledAt?.toISO() ?? null,
      recoveryCodesLeft: user.twoFactorEnabled ? await this.twoFactor.recoveryCodesLeft(user) : 0,
    })
  }

  async setupTwoFactor({ auth }: HttpContext) {
    return ok(await this.twoFactor.setup(auth.getUserOrFail()))
  }

  async enableTwoFactor({ auth, request }: HttpContext) {
    const { code } = await request.validateUsing(totpCodeValidator)
    const recoveryCodes = await this.twoFactor.enable(auth.getUserOrFail(), code)
    return ok({ recoveryCodes })
  }

  async disableTwoFactor({ auth, request }: HttpContext) {
    const { password } = await request.validateUsing(passwordConfirmValidator)
    await this.twoFactor.disable(auth.getUserOrFail(), password)
    return messageOnly('App autenticador desativado. Os acessos voltam a usar o código por e-mail.')
  }

  async regenerateRecoveryCodes({ auth, request }: HttpContext) {
    const { code } = await request.validateUsing(totpCodeValidator)
    const recoveryCodes = await this.twoFactor.regenerateRecoveryCodes(auth.getUserOrFail(), code)
    return ok({ recoveryCodes })
  }
}
