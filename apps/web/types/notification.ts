import type { ReactNode } from "react";

export interface NotificationContextType {
  isSupported: boolean;
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export interface NotificationProviderProps {
  children: ReactNode;
}

import type {
  Notification,
  NotificationListMeta,
  PaginationMeta,
} from "@react-menu/contracts";

export type { NotificationCategory, UserEvent } from "@react-menu/contracts";

export type AppNotification = Notification;

/** GET /notifications after the RTK Query envelope unwrap. */
export interface NotificationList {
  data: Notification[];
  meta: PaginationMeta & NotificationListMeta;
}
