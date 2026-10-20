import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { env } from "@/lib/env";

/**
 * Web push uses Firebase Cloud Messaging. It is optional: without the
 * NEXT_PUBLIC_FIREBASE_* variables the push toggle is disabled.
 */
export function isPushConfigured() {
  return Boolean(
    env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      env.NEXT_PUBLIC_FIREBASE_APP_ID &&
      env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  );
}

/** Browser-only Firebase app; call only after `isPushConfigured()`. */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();

  return initializeApp({
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}
