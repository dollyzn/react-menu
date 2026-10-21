import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import type { Notification as NotificationDto } from '@react-menu/contracts'
import Notification from '#models/notification'
import PushService from '#services/push_service'
import type StoreRole from '#enums/store_role'
import SendPushNotification from '#jobs/send_push_notification'
import { broadcastUserEvent } from '#helpers/realtime'
import {
  renderNotification,
  type NotificationData,
  type NotificationType,
} from '#notifications/templates'

type Recipients = {
  userIds: string[]
  /** Store the notification is about; scopes it and cascades on delete. */
  storeId?: string | null
}

type ListOptions = {
  page?: number
  perPage?: number
  unreadOnly?: boolean
}

@inject()
export default class NotificationService {
  constructor(private push: PushService) {}

  /**
   * Persists one notification per recipient, then delivers it in realtime
   * and via web push. Delivery is best effort; the stored row is the truth.
   */
  async notify<Type extends NotificationType>(
    type: Type,
    data: NotificationData<Type>,
    recipients: Recipients
  ) {
    const userIds = [...new Set(recipients.userIds)]
    if (userIds.length === 0) return []

    const rendered = renderNotification(type, data)

    const notifications = await Notification.createMany(
      userIds.map((userId) => ({
        userId,
        storeId: recipients.storeId ?? null,
        type,
        category: rendered.category,
        title: rendered.title,
        body: rendered.body,
        url: rendered.url ?? null,
        data: data as Record<string, unknown>,
      }))
    )

    for (const notification of notifications) {
      broadcastUserEvent({
        type: 'notification.created',
        userId: notification.userId,
        // The model serializes to the Notification contract (camelCase, ISO dates).
        notification: notification.serialize() as NotificationDto,
      })

      // Off the request, retried by the queue; the stored row is the truth.
      if (this.push.isEnabled) {
        await SendPushNotification.dispatch({
          userId: notification.userId,
          message: {
            title: notification.title,
            body: notification.body,
            url: notification.url,
            tag: notification.id,
          },
        })
          .run()
          .catch((error) => logger.error({ err: error }, 'could not queue web push'))
      }
    }

    return notifications
  }

  /** Notifies every member of a store, optionally skipping the actor. */
  async notifyStoreMembers<Type extends NotificationType>(
    storeId: string,
    type: Type,
    data: NotificationData<Type>,
    options: { exceptUserId?: string; roles?: StoreRole[] } = {}
  ) {
    const members = await db
      .from('store_user')
      .where('store_id', storeId)
      .if(options.exceptUserId, (query) => query.whereNot('user_id', options.exceptUserId!))
      .if(options.roles?.length, (query) => query.whereIn('role', options.roles!))
      .select('user_id')

    return await this.notify(type, data, {
      userIds: members.map((member) => member.user_id),
      storeId,
    })
  }

  /** Platform admins (super users), e.g. for background job failures. */
  async notifySuperUsers<Type extends NotificationType>(type: Type, data: NotificationData<Type>) {
    const admins = await db.from('users').where('super_user', true).select('id')
    return await this.notify(type, data, { userIds: admins.map((admin) => admin.id) })
  }

  async list(userId: string, { page = 1, perPage = 20, unreadOnly = false }: ListOptions = {}) {
    const notifications = await Notification.query()
      .where('userId', userId)
      .if(unreadOnly, (query) => query.whereNull('readAt'))
      .orderBy('createdAt', 'desc')
      .paginate(page, perPage)

    const [unread] = await Notification.query()
      .where('userId', userId)
      .whereNull('readAt')
      .count('* as total')

    return { notifications, unreadCount: Number(unread.$extras.total) }
  }

  async markAsRead(userId: string, id: string) {
    const notification = await Notification.query().where({ id, userId }).firstOrFail()
    if (!notification.readAt) {
      notification.readAt = DateTime.now()
      await notification.save()
    }
    return notification
  }

  async markAllAsRead(userId: string) {
    await Notification.query()
      .where('userId', userId)
      .whereNull('readAt')
      .update({ readAt: DateTime.now().toSQL() })
  }

  async remove(userId: string, id: string) {
    const notification = await Notification.query().where({ id, userId }).firstOrFail()
    await notification.delete()
  }

  async clear(userId: string) {
    await Notification.query().where('userId', userId).delete()
  }
}
