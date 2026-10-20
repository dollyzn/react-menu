import type { StoreStatus } from './entities.ts';
import type { Notification } from './notifications.ts';

/**
 * Transmit (SSE) channels and the events published on them.
 * Producer: apps/api/app/helpers/realtime.ts; authorization: apps/api/start/transmit.ts.
 * Events are refetch hints; the HTTP API stays the source of truth.
 */
export type StoreChannel = `stores/${string}`;
export type UserNotificationsChannel = `users/${string}/notifications`;

export type StoreEvent = {
  type: 'store.status_changed';
  storeId: string;
  status: StoreStatus;
};

export type UserEvent = {
  type: 'notification.created';
  userId: string;
  notification: Notification;
};
