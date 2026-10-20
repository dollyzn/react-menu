# 0012. Two installable apps: customer menu and staff panel

- Status: Accepted
- Date: 2026-10-20

## Context

Customers and staff use the same origin. With one manifest (`start_url: /`),
an attendant installing from the panel got the customer menu on the home
screen, and the store name could not appear on customers' devices.

## Decision

Two web app manifests with distinct `id` and nested scopes:

- `/manifest.webmanifest` (`app/manifest.ts`): customer app, scope `/`,
  named after the default store, portrait.
- `/app/manifest.webmanifest` (route handler, linked by `app/app/layout.tsx`):
  staff app, scope `/app/`, opens `/app/stores`, any orientation (tablets).

The service worker (`public/sw.js`, scope `/`) only adds an offline page for
navigations and handles push; pages and API data are never cached because
menus, stock and orders must be live.

The install invitation follows the "promote, don't nag" pattern:
`beforeinstallprompt` is captured in `<head>` before hydration, the custom UI
shows only after engagement (returning visit or an order for customers; a
sidebar card and a user-menu entry for staff), "not now" snoozes it for 14
days per device, and iOS gets manual Share → Add to Home Screen steps.

## Alternatives considered

- **One manifest**: simpler, but the wrong start page for one audience.
- **Caching the app shell (offline menu)**: stale prices/availability would
  produce orders the API rejects; not worth it for a pickup counter.

## Consequences

Changing a manifest `id` creates a different app on devices, so the ids stay
`/` and `/app/`. `e2e/pwa.spec.ts` asserts both apps stay installable
(`PWA_SCREENSHOTS=1` regenerates the manifest screenshots); icons come from
`apps/web/scripts/generate-pwa-icons.mjs`.
