import type { JsonValue } from './api.ts';

/** Producer: apps/api/app/notifications/templates.ts. */
export type NotificationCategory = 'order' | 'store' | 'system';

export type Notification = {
  id: string;
  userId: string;
  storeId: string | null;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  url: string | null;
  /** Template input data (see the producer). */
  data: { [key: string]: JsonValue };
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `meta` of GET /notifications. */
export type NotificationListMeta = { unreadCount: number };
