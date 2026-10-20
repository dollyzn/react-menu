import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import PushService from '#services/push_service'
import { pushRegistrationValidator } from '#validators/notification'
import { messageOnly, ok } from '#helpers/api_response'

@inject()
export default class PushRegistrationsController {
  constructor(private pushService: PushService) {}

  async register({ request, auth }: HttpContext) {
    const { fid } = await request.validateUsing(pushRegistrationValidator)

    await this.pushService.register(auth.getUserOrFail().id, fid)

    return messageOnly('Notificações push ativadas')
  }

  async unregister({ request, auth }: HttpContext) {
    const { fid } = await request.validateUsing(pushRegistrationValidator)

    await this.pushService.unregister(auth.getUserOrFail().id, fid)

    return messageOnly('Notificações push desativadas')
  }

  async check({ request, auth }: HttpContext) {
    const { fid } = await request.validateUsing(pushRegistrationValidator)

    const registered = await this.pushService.isRegistered(auth.getUserOrFail().id, fid)

    return ok({ registered })
  }
}
