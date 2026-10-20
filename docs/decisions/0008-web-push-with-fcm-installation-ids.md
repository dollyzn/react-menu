# 0008. Web push with Firebase Cloud Messaging, addressed by installation ID

- Status: Accepted (amends the delivery channel in 0006)
- Date: 2026-10-20

## Context

Web push was first built on the raw Web Push protocol (`web-push`, VAPID
keys generated and stored by us, one subscription row per
endpoint/p256dh/auth). The maintainer prefers Firebase Cloud Messaging,
whose messaging is free on every Firebase plan, so the same pipeline can
later reach native Android/iOS apps.

In current SDKs (firebase 13 / firebase-admin 14) addressing devices by FCM
registration token (`getToken`, `tokens`) is deprecated in favor of
Firebase Installation IDs (`register` + `onRegistered`, `fids`).

## Decision

- The browser registers with FCM (`register()` with the Firebase web push
  certificate and our `/sw.js` registration) and the app stores the
  installation's FID via `POST /notifications/push/register`.
- The API sends data-only multicast messages with `firebase-admin`
  (`sendEachForMulticast({ fids })`) using a service account, and deletes
  FIDs that FCM reports as `installation-id-not-registered`.
- `/sw.js` renders the notification itself (no Firebase code in the worker)
  and skips it while a tab is focused, because the realtime toast already
  shows it.
- Push stays optional: without `FIREBASE_*` (API) / `NEXT_PUBLIC_FIREBASE_*`
  (web) variables it is disabled.

## Alternatives considered

- **Keep raw Web Push (VAPID)**: no third party, but no path to native apps
  and key management stays on us.
- **FCM registration tokens**: works today, but deprecated by the SDKs.

## Consequences

- Requires a Firebase project; web push certificates are managed in the
  Firebase console.
- `push_subscriptions` was replaced by `push_registrations (user_id, fid)`.
