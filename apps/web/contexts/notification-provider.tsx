"use client";

import { createContext, useContext, useState } from "react";
import {
  getMessaging,
  isSupported as isMessagingSupported,
  register,
  unregister,
} from "firebase/messaging";
import { getId, getInstallations } from "firebase/installations";
import type {
  NotificationContextType,
  NotificationProviderProps,
} from "@/types/notification";
import useDebouncedEffect from "@/hooks/use-debonced-effect";
import { env } from "@/lib/env";
import { getFirebaseApp, isPushConfigured } from "@/lib/firebase";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { notificationApi } from "@/redux/features/notification/notificationApi";

const NotificationContext = createContext<NotificationContextType | null>(null);

/** Firebase calls must never block the UI (logout awaits `unsubscribe`). */
const FIREBASE_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Firebase timeout")), FIREBASE_TIMEOUT_MS)
    ),
  ]);
}

/** The Firebase Installation ID that FCM uses to address this browser. */
function currentFid() {
  return withTimeout(getId(getInstallations(getFirebaseApp())));
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  async function setup() {
    if (!isPushConfigured()) {
      setError("Notificações push não estão configuradas neste ambiente.");
      setIsSupported(false);
      return;
    }

    if (!("serviceWorker" in navigator) || !(await isMessagingSupported())) {
      setError("Seu navegador não suporta notificações push.");
      setIsSupported(false);
      return;
    }

    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      setIsSupported(true);

      if (Notification.permission !== "granted") {
        setIsSubscribed(false);
        return;
      }

      const { registered } = await dispatch(
        notificationApi.endpoints.checkPush.initiate({ fid: await currentFid() })
      ).unwrap();
      setIsSubscribed(registered);
    } catch {
      setError("Não foi possível preparar as notificações push.");
      setIsSupported(false);
    }
  }

  useDebouncedEffect(() => {
    // Checking the registration needs a session.
    if (isAuthenticated) void setup();
  }, [isAuthenticated]);

  async function subscribe() {
    if (!isSupported) return;

    const permission = await Notification.requestPermission();

    if (permission === "denied") {
      setError("Permissão negada. Ative nas configurações do navegador.");
      return;
    }

    if (permission !== "granted") return;

    setLoading(true);
    setError(null);

    try {
      const serviceWorkerRegistration =
        await navigator.serviceWorker.getRegistration("/");

      await withTimeout(
        register(getMessaging(getFirebaseApp()), {
          vapidKey: env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration,
        })
      );

      await dispatch(
        notificationApi.endpoints.registerPush.initiate({ fid: await currentFid() })
      ).unwrap();

      setIsSubscribed(true);
    } catch {
      setError("Não foi possível ativar as notificações push. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  /** Also runs on logout, so it must never hang or throw. */
  async function unsubscribe() {
    if (!isPushConfigured() || !isSubscribed) {
      setIsSubscribed(false);
      return;
    }

    setLoading(true);

    try {
      const fid = await currentFid();
      await dispatch(
        notificationApi.endpoints.unregisterPush.initiate({ fid })
      ).unwrap();
      await withTimeout(unregister(getMessaging(getFirebaseApp())));
    } catch {
      // The server prunes installations FCM reports as unregistered.
    } finally {
      setIsSubscribed(false);
      setLoading(false);
    }
  }

  return (
    <NotificationContext.Provider
      value={{
        isSupported,
        isSubscribed,
        subscribe,
        unsubscribe,
        loading,
        error,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotification must be used within an NotificationProvider"
    );
  return ctx;
}
