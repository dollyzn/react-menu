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

/** One notification type in the preferences: push and e-mail (the bell always records it). */
export type NotificationTypePreference = {
  type: string;
  category: NotificationCategory;
  label: string;
  description: string;
  push: boolean;
  email: boolean;
};

/** GET/PUT /account/notification-preferences. */
export type NotificationPreferences = {
  types: NotificationTypePreference[];
  /** The stores the person works in; a muted one sends no push or e-mail. */
  stores: { id: string; name: string; muted: boolean }[];
  /** Daily e-mail with yesterday's numbers of the stores they manage. */
  dailySummary: {
    /** Only for people who manage a store. */
    available: boolean;
    enabled: boolean;
    /** Hour of the day it goes out (0-23, the store's timezone). */
    hour: number;
  };
};

export type NotificationPreferencesInput = {
  channels: Record<string, { push: boolean; email: boolean }>;
  mutedStoreIds: string[];
  dailySummary: { enabled: boolean; hour: number };
};
