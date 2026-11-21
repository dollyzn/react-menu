import transmit from '@adonisjs/transmit/services/main'
import type { OrderTrackingEvent, PartnerEvent, StoreEvent, UserEvent } from '@react-menu/contracts'

/**
 * Realtime is a notification channel, not a source of truth: every event
 * reflects state that is already persisted and readable over HTTP, so a
 * client that missed events can always refetch.
 *
 * Every channel used here must be authorized in start/transmit.ts.
 */
export const channels = {
  // Channel names are mirrored by the web app (types: StoreChannel, UserNotificationsChannel).
  store: (storeId: string) => `stores/${storeId}`,
  userNotifications: (userId: string) => `users/${userId}/notifications`,
  orderTracking: (publicToken: string) => `orders/${publicToken}`,
  partner: (storeId: string, partnerId: string) => `stores/${storeId}/partners/${partnerId}`,
}

export function broadcastStoreEvent(event: StoreEvent) {
  transmit.broadcast(channels.store(event.storeId), event)
}

export function broadcastUserEvent(event: UserEvent) {
  transmit.broadcast(channels.userNotifications(event.userId), event)
}

export function broadcastOrderTracking(publicToken: string, event: OrderTrackingEvent) {
  transmit.broadcast(channels.orderTracking(publicToken), event)
}

/**
 * After the commit: what the menu offers changed (an item sold out by hand,
 * stock tracking turned on): panels with the menu open read it again.
 */
export function broadcastMenuChanged(storeId: string) {
  broadcastStoreEvent({ type: 'menu.changed', storeId })
}

/**
 * After the commit: something about a partner's orders changed (status,
 * payment, a cancellation request, a settlement). Their screens refetch.
 */
export function broadcastPartnerEvent(event: PartnerEvent) {
  transmit.broadcast(channels.partner(event.storeId, event.partnerId), event)
}
