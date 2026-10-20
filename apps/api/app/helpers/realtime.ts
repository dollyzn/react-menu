import transmit from '@adonisjs/transmit/services/main'
import type StoreStatus from '#enums/store_status'

/**
 * Realtime is a notification channel, not a source of truth: every event
 * reflects state that is already persisted and readable over HTTP, so a
 * client that missed events can always refetch.
 */
export const channels = {
  store: (storeId: string) => `stores/${storeId}`,
}

export type StoreEvent = {
  type: 'store.status_changed'
  storeId: string
  status: StoreStatus
}

export function broadcastStoreEvent(event: StoreEvent) {
  transmit.broadcast(channels.store(event.storeId), event)
}
