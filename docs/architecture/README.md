# Architecture

How React Menu works today. Rules for changing it are in the root
`AGENTS.md`; the reasons behind them are in `../decisions/`.

## Components

```
Browser ── Next.js (apps/web) ──────────────┐
   │        admin UI, public menu, proxy.ts  │ same host recommended (see Deployment)
   │                                         │
   ├── HTTP  /api/v1/*  ───────────► AdonisJS API (apps/api)
   └── SSE   /__transmit/*  ───────►   ├── PostgreSQL (data, access tokens)
                                       ├── Redis (rate limits, Transmit pub/sub)
                                       └── Drive: fs | S3 | R2 (store images)
```

`packages/contracts` holds the shared response/entity/event types (type-only).

## API request lifecycle

```
server middleware   container bindings → force JSON → CORS → cookie→Bearer → static
router middleware   bodyparser → initialize auth → initialize bouncer
route middleware    auth → throttle → storeAccess (for /stores/:storeId/*)
controller          validate params + body (VineJS) → authorize (policies)
service             business rules, db.transaction, then broadcast/notify
repository          Lucid queries, always scoped by store for tenant data
response            ok()/created()/... envelope, or exception → handler.ts
```

Route groups (`start/routes.ts`): `/health` (token + IP allowlist),
`/__transmit/*` (auth), and `/api/v1` with `auth`, `users`,
`notifications`, public `GET /stores/:storeId/menu`, `POST /stores`, and the
`/stores/:storeId` group (store detail, dashboard, categories, items, addons).

## Data model

```
users ─┬─< store_user >─ stores ─┬─< categories ─< items >─< addon_item >─ addons
       │   (unique pair)         ├─< addons                                  │
       │                         └─< store_views                 (addons.store_id)
       ├─ roles ─< permission_role >─ permissions
       ├─< auth_access_tokens
       ├─< user_social_accounts
       ├─< push_registrations (FCM installation ids)
       └─< notifications (store_id nullable)
```

All child rows cascade on delete. Prices are `decimal(10,2)`. One store can
be flagged `is_default` (partial unique index).

## Authentication and authorization

1. `POST /auth/login` verifies credentials (rate-limited per IP + email) and
   sets an httpOnly cookie with an opaque access token (7 days).
2. `CookieAuthMiddleware` turns the cookie into a Bearer header; the tokens
   guard resolves the user. Inactive users get 403.
3. `storeAccess` checks store membership (`accessStore` ability); store
   creation/deletion and user management check role permissions
   (`StorePolicy`, `UserPolicy`); super users bypass both.
4. The web app persists the user in IndexedDB for instant UI, revalidates it
   with `GET /auth/me`, and shows the "session expired" dialog only on 401.
   `proxy.ts` redirects based on the cookie's presence (UX, not security).

## Realtime and notifications

```
service (after commit)
  ├─ broadcastStoreEvent ─► stores/:id                 ─► useStoreRealtime: invalidate Store tag
  └─ NotificationService.notify
        ├─ insert notifications rows
        ├─ broadcastUserEvent ─► users/:id/notifications ─► toast + invalidate Notification tag
        └─ FCM web push (if configured) ─► public/sw.js shows the OS notification
```

Clients refetch after reconnecting, so a missed event never leaves stale UI.

## Web app structure

- `app/app/(auth)`: login, logout, social callback.
- `app/app/stores/[store]/*`: store home, overview (dashboard), categories,
  items, addons. CRUD screens share `components/app/data-table` (filters,
  sorting, column visibility, table/card views, bulk delete) and dialog
  patterns (create/update/delete dialogs per domain).
- `components/ui`: shadcn `base-nova` style on Base UI primitives.
- Server state in RTK Query (`redux/features/*`); only `auth` is persisted.

## Deployment

- Web: Next.js (`next build`/`next start`); the current workflow deploys to
  a VPS over SSH with PM2 (`.github/workflows/deploy-web.yml`).
- API: `node ace build`, then install production deps; in the monorepo use
  `pnpm deploy --filter @react-menu/api <dir>`. Run migrations on deploy.
- The auth cookie is host-only and `SameSite=Strict`: serve web and API from
  the same host (reverse proxy routing `/api` and `/__transmit` to the API)
  so `proxy.ts` can see the cookie. Disable proxy buffering for
  `/__transmit/events` (SSE).
- Health: `GET /health` with `x-monitoring-secret` (and optional IP allowlist).
