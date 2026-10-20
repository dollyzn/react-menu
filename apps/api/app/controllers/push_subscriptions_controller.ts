import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import PushService from '#services/push_service'
import { pushEndpointValidator, pushSubscribeValidator } from '#validators/notification'
import { messageOnly, ok } from '#helpers/api_response'

@inject()
export default class PushSubscriptionsController {
  constructor(private pushService: PushService) {}

  async subscribe({ request, auth }: HttpContext) {
    const payload = await request.validateUsing(pushSubscribeValidator)

    await this.pushService.subscribe(auth.getUserOrFail().id, payload)

    return messageOnly('Notificações push ativadas')
  }

  async unsubscribe({ request, auth }: HttpContext) {
    const { endpoint } = await request.validateUsing(pushEndpointValidator)

    await this.pushService.unsubscribe(auth.getUserOrFail().id, endpoint)

    return messageOnly('Notificações push desativadas')
  }

  async check({ request, auth }: HttpContext) {
    const { endpoint } = await request.validateUsing(pushEndpointValidator)

    const subscribed = await this.pushService.isSubscribed(auth.getUserOrFail().id, endpoint)

    return ok({ subscribed })
  }
}
