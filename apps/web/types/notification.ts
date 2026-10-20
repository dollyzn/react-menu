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
