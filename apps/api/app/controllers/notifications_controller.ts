import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import NotificationService from '#services/notification_service'
import { uuidValidator } from '#validators/common'
import { messageOnly, ok } from '#helpers/api_response'
import { parsePagination } from '#helpers/query_string_parser'

@inject()
export default class NotificationsController {
  constructor(private notificationService: NotificationService) {}

  async index({ request, auth }: HttpContext) {
    const q = request.qs()

    const { notifications, unreadCount } = await this.notificationService.list(
      auth.getUserOrFail().id,
      { ...parsePagination(q), unreadOnly: q.unread === 'true' }
    )

    return ok(notifications.all(), { ...notifications.getMeta(), unreadCount })
  }

  async markAsRead({ params, auth }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const notification = await this.notificationService.markAsRead(auth.getUserOrFail().id, id)

    return ok(notification)
  }

  async markAllAsRead({ auth }: HttpContext) {
    await this.notificationService.markAllAsRead(auth.getUserOrFail().id)

    return messageOnly('Notificações marcadas como lidas')
  }

  async destroy({ params, auth }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    await this.notificationService.remove(auth.getUserOrFail().id, id)

    return messageOnly('Notificação excluída')
  }

  async clear({ auth }: HttpContext) {
    await this.notificationService.clear(auth.getUserOrFail().id)

    return messageOnly('Notificações excluídas')
  }
}
