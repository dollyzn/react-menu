import transmit from '@adonisjs/transmit/services/main'
import type { ModelObject } from '@adonisjs/lucid/types/model'
import type StoreStatus from '#enums/store_status'

/**
 * Realtime is a notification channel, not a source of truth: every event
 * reflects state that is already persisted and readable over HTTP, so a
 * client that missed events can always refetch.
 *
 * Every channel used here must be authorized in start/transmit.ts.
 */
export const channels = {
  store: (storeId: string) => `stores/${storeId}`,
  userNotifications: (userId: string) => `users/${userId}/notifications`,
}

export type StoreEvent = {
  type: 'store.status_changed'
  storeId: string
  status: StoreStatus
}

export type UserEvent = {
  type: 'notification.created'
  userId: string
  notification: ModelObject
}

export function broadcastStoreEvent(event: StoreEvent) {
  transmit.broadcast(channels.store(event.storeId), event)
}

export function broadcastUserEvent(event: UserEvent) {
  transmit.broadcast(channels.userNotifications(event.userId), event)
}
