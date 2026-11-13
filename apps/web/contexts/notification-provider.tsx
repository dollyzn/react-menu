"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  getMessaging,
  isSupported as isMessagingSupported,
  register,
  unregister,
} from "firebase/messaging";
import type {
  NotificationContextType,
  NotificationProviderProps,
} from "@/types/notification";
import useDebouncedEffect from "@/hooks/use-debonced-effect";
import { env } from "@/lib/env";
import { getFirebaseApp, isPushConfigured } from "@/lib/firebase";
import { currentFid, listenForFid, pushErrorMessage, withTimeout } from "@/lib/web-push";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { notificationApi } from "@/redux/features/notification/notificationApi";

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const signedIn = useRef(isAuthenticated);
  const stopListening = useRef<(() => void) | null>(null);
  const subscribing = useRef(false);

  useEffect(() => {
    signedIn.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => () => stopListening.current?.(), []);

  /**
   * FCM may hand this browser a new installation ID (refresh, restore):
   * send it to the API so push keeps arriving. Only while signed in and
   * subscribed on this device.
   */
  function listenForNewInstallations() {
    if (stopListening.current) return;
    stopListening.current = listenForFid((fid) => {
      // While turning push on, subscribe() registers this FID itself.
      if (!signedIn.current || subscribing.current) return;
      void dispatch(notificationApi.endpoints.registerPush.initiate({ fid }))
        .unwrap()
        .then(() => setIsSubscribed(true))
        .catch(() => undefined);
    });
  }

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
      if (registered) listenForNewInstallations();
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
    subscribing.current = true;

    try {
      const serviceWorkerRegistration =
        await navigator.serviceWorker.getRegistration("/");

      // Firebase refuses register() until an onRegistered handler exists
      // (messaging/invalid-on-registered-handler).
      listenForNewInstallations();
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
    } catch (error) {
      // Logged for support: the reasons are in the browser, not the API.
      console.warn("push subscribe failed", error);
      setError(pushErrorMessage(error));
    } finally {
      subscribing.current = false;
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
    stopListening.current?.();
    stopListening.current = null;

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
