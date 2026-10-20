import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const NotificationsController = () => import('#controllers/notifications_controller')
const PushSubscriptionsController = () => import('#controllers/push_subscriptions_controller')

export default function notificationsRoutes() {
  router
    .group(() => {
      router.get('/', [NotificationsController, 'index']).as('notifications.index')
      router
        .post('/read-all', [NotificationsController, 'markAllAsRead'])
        .as('notifications.readAll')
      router.delete('/', [NotificationsController, 'clear']).as('notifications.clear')

      router
        .post('/push/subscribe', [PushSubscriptionsController, 'subscribe'])
        .as('notifications.push.subscribe')
      router
        .post('/push/unsubscribe', [PushSubscriptionsController, 'unsubscribe'])
        .as('notifications.push.unsubscribe')
      router
        .post('/push/check', [PushSubscriptionsController, 'check'])
        .as('notifications.push.check')

      router.patch('/:id/read', [NotificationsController, 'markAsRead']).as('notifications.read')
      router.delete('/:id', [NotificationsController, 'destroy']).as('notifications.destroy')
    })
    .prefix('/notifications')
    .use([middleware.auth(), throttle])
}
