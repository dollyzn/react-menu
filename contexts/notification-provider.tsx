"use client";

import { createContext, useContext, useState } from "react";
import { request } from "@/lib/api";
import { BaseResponse, RequestError } from "@/types/request";
import type {
  NotificationContextType,
  NotificationProviderProps,
} from "@/types/notification";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/redux/store";
import { toast } from "sonner";
import useDebouncedEffect from "@/hooks/use-debonced-effect";
import { env } from "@/lib/env";
import { useAppSelector } from "@/redux/hooks";

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useDebouncedEffect(async () => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setError("Seu navegador não suporta notificações push.");
      setIsSupported(false);
      return;
    }

    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      setError("Notificações Push requerem HTTPS.");
      setIsSupported(false);
      return;
    }

    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setIsSupported(true);

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      const valid = await check(subscription);

      if (valid) {
        setIsSubscribed(true);
      } else {
        await subscription.unsubscribe();
        setIsSubscribed(false);

        if (isAuthenticated) {
          toast.info(
            "Notificações push foram desativadas, acesse as configurações para reativar."
          );
        }
      }
    } catch {
      setError("Erro ao registrar Service Worker para notificações.");
      setIsSupported(false);
    }
  }, []);

  async function subscribe() {
    if (!isSupported) return;

    const permission = await Notification.requestPermission();

    if (permission === "denied") {
      setError("Permissão negada. Ative nas configurações do navegador.");
      return;
    }

    if (permission !== "granted") return;

    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        ),
      });

      const response = await request({
        url: "notifications/subscribe",
        method: "post",
        data: subscription,
        showErrorMessage: true,
        dispatch,
      });

      if (!response.success)
        throw new RequestError(response.error || "Erro desconhecido");

      setIsSubscribed(true);
    } catch (err) {
      const message =
        err instanceof RequestError
          ? err.message
          : "Erro ao tentar inscrever. Tente novamente.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      const response = await request({
        url: "notifications/unsubscribe",
        method: "post",
        data: {
          endpoint: subscription?.endpoint,
        },
        showErrorMessage: true,
      });

      await subscription?.unsubscribe();

      if (!response.success)
        throw new RequestError(response.error || "Erro desconhecido");
    } catch (err) {
      const message =
        err instanceof RequestError
          ? err.message
          : "Erro ao cancelar inscrição. Tente novamente.";
      setError(message);
    } finally {
      setIsSubscribed(false);
      setLoading(false);
    }
  }

  async function check(
    subscription?: PushSubscription | null
  ): Promise<boolean> {
    setLoading(true);
    try {
      let sub = subscription;

      if (!sub) {
        const registration = await navigator.serviceWorker.ready;
        sub = await registration.pushManager.getSubscription();
      }

      const response = await request<BaseResponse & { subscribed: boolean }>({
        url: "notifications/check",
        method: "post",
        data: {
          endpoint: sub?.endpoint,
        },
      });

      if (response.success && !response.subscribed) {
        await sub?.unsubscribe();
        setIsSubscribed(false);
        return false;
      }

      setIsSubscribed(!!sub);
      return response.subscribed;
    } catch (err) {
      const message =
        err instanceof RequestError
          ? err.message
          : "Erro ao verificar inscrição.";
      setError(message);
      return false;
    } finally {
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
        check,
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
