import type { ReactNode } from "react";

export interface NotificationContextType {
  isSupported: boolean;
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  check: (subscription?: PushSubscription | null) => Promise<boolean>;
}

export interface NotificationProviderProps {
  children: ReactNode;
}

/** Mirrors `NotificationCategory` in apps/api/app/notifications/templates.ts. */
export type NotificationCategory = "store" | "system";

export interface AppNotification {
  id: string;
  userId: string;
  storeId: string | null;
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  url: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationList {
  data: AppNotification[];
  meta: { total: number; unreadCount: number };
}

/** Mirrors `UserEvent` in apps/api/app/helpers/realtime.ts. */
export type UserEvent = {
  type: "notification.created";
  userId: string;
  notification: AppNotification;
};
