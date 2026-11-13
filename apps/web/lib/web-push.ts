"use client";

import { getMessaging, isSupported as isMessagingSupported, onRegistered, register } from "firebase/messaging";
import { getId, getInstallations } from "firebase/installations";
import { env } from "@/lib/env";
import { getFirebaseApp, isPushConfigured } from "@/lib/firebase";

/** Firebase calls must never block the UI (logout awaits unsubscribing). */
const FIREBASE_TIMEOUT_MS = 10_000;

export function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Firebase timeout")), FIREBASE_TIMEOUT_MS)
    ),
  ]);
}

/**
 * What went wrong turning push on, in words the person can act on. The
 * browser refuses the push subscription itself in the common cases (Brave
 * blocks Google's push service by default; a blocked network or extension).
 */
export function pushErrorMessage(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  if (name === "AbortError" || /push service/i.test(message)) {
    return /brave/i.test(navigator.userAgent) || "brave" in navigator
      ? 'O Brave bloqueia notificações push por padrão: ative "Usar serviços do Google para mensagens push" em brave://settings/privacy e tente de novo.'
      : "O navegador recusou o serviço de notificações push. Verifique se alguma extensão ou bloqueador não está impedindo e tente de novo.";
  }
  if (name === "NotAllowedError") return "Permissão negada. Ative as notificações nas configurações do navegador.";
  if (message === "Firebase timeout") return "O serviço de notificações demorou a responder. Verifique a conexão e tente de novo.";
  return `Não foi possível ativar as notificações push (${name || message}). Tente novamente.`;
}

/** The Firebase Installation ID that FCM uses to address this browser. */
export function currentFid() {
  return withTimeout(getId(getInstallations(getFirebaseApp())));
}

/** Push can work here: configured, a service worker, and FCM supported by the browser. */
export async function webPushAvailable() {
  if (!isPushConfigured() || typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  return await isMessagingSupported().catch(() => false);
}

/**
 * Turns web push on in this browser (asks permission, subscribes it with
 * FCM) and answers its installation ID. `onNewFid` hears about a new ID
 * FCM hands out later (refresh, restore). Throws a NotAllowedError when
 * permission is refused.
 */
export async function enableWebPush(onNewFid: (fid: string) => void) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new DOMException("Notification permission refused", "NotAllowedError");

  const serviceWorkerRegistration =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  const messaging = getMessaging(getFirebaseApp());
  // Firebase refuses register() until an onRegistered handler exists
  // (messaging/invalid-on-registered-handler).
  onRegistered(messaging, onNewFid);
  await withTimeout(register(messaging, { vapidKey: env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, serviceWorkerRegistration }));
  return await currentFid();
}
