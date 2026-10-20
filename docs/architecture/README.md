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
                                       ├── Drive: fs | S3 | R2 (store images)
                                       ├── Mercado Pago (Checkout Pro, per store)
                                       └── Firebase Cloud Messaging (web push)
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
`/__transmit/*` (silent auth; each channel authorizes itself), and `/api/v1`
with `auth`, `users`, `notifications`, `public/*` (menu, place order, track
order; no login), `webhooks/mercado-pago/:storeId` (signature), `POST
/stores`, and the `/stores/:storeId` group (detail, settings, dashboard,
catalog, inventory, orders, kitchen). Inside a store, `managersOnly` and
`frontOfHouse` restrict routes by store role.

## Data model

```
users ─┬─< store_user (role) >─ stores ─┬─< categories ─< items >─< addon_item >─ addons
       │                                ├─< addons                      │
       │                                ├─< store_views          items/addons >─< *_ingredients >─ ingredients
       │                                ├─< ingredients ─< stock_movements >─ orders
       │                                ├─< customers (name, phone)
       │                                └─< orders ─┬─< order_items ─< order_item_addons
       │                                            └─< order_status_histories
       ├─ roles ─< permission_role >─ permissions
       ├─< auth_access_tokens, user_social_accounts
       ├─< push_registrations (FCM installation ids)
       └─< notifications (store_id nullable)
```

Child rows cascade on delete; order lines keep name/price snapshots and
`SET NULL` their menu references. Money is `decimal(10,2)`, stock is
`decimal(12,3)`, both consumed as numbers. One store can be `is_default`
(served at `/`). Orders are numbered per store and business day.

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

## Order lifecycle

```
customer (public menu)        POS (attendant)
   │ POST /public/menu/:slug/orders   │ POST /stores/:id/orders
   ▼                                  ▼
OrderService.create: price from the menu, validate add-ons/availability,
upsert customer by phone, number = max(today) + 1 under a store row lock
   │
   ├─ Mercado Pago ─► pending_payment ─► checkout ─► webhook (signed) ─► paid
   │                                                                   │
   └─ counter / POS ───────────────────────────────────────────────────┤
                                                                       ▼
                     received ─(stock consumed per recipe)─► kitchen queue
                         │  cook marks units (prepared_quantity)
                         ▼
                     preparing ─► ready (all units done) ─► completed (handed over;
                         counter payment settled)        cancelled → stock reversed
```

Kitchen batches (`app/kitchen/production_queue.ts`): start from the oldest
pending unit and pull identical units (same item and add-ons, no notes) from
at most the next 3 orders, so no order waits behind more than 3 newer ones.
Each batch carries the summed ingredients of its recipes.

## Realtime and notifications

```
service (after commit)
  ├─ broadcastStoreEvent ─► stores/:id                 ─► useStoreRealtime: invalidate Store/Order/Kitchen
  ├─ broadcastOrderTracking ─► orders/:token (public)  ─► tracking page refetches
  └─ NotificationService.notify
        ├─ insert notifications rows
        ├─ broadcastUserEvent ─► users/:id/notifications ─► toast + invalidate Notification tag
        └─ FCM web push (if configured) ─► public/sw.js shows the OS notification
```

Clients refetch after reconnecting, so a missed event never leaves stale UI.

## Web app structure

- `app/(menu)`: customer menu (SSR) at `/` and `/[slug]`, bag and checkout,
  tracking at `/pedido/[token]`.
- `app/app/(auth)`: login, logout, social callback.
- `app/app/stores/[store]/{orders,pos,kitchen,inventory}`: operations by role.
- `app/app/stores/[store]/*`: store home, overview (dashboard), categories,
  items, addons. CRUD screens share `components/app/data-table` (filters,
  sorting, column visibility, table/card views, bulk delete) and dialog
  patterns (create/update/delete dialogs per domain).
- `components/ui`: shadcn `base-nova` style on Base UI primitives.
- Server state in RTK Query (`redux/features/*`); `auth`, `cart` and
  `customer` are persisted (IndexedDB) and only read after hydration.

## Deployment

- Docker (recommended): `Dockerfile` targets `api` (compiled Adonis, prod
  deps only, migrations on start) and `web` (Next standalone server);
  `docker-compose.yml` runs them behind Caddy on a single origin with
  Postgres and Redis. The Next server reaches the API through
  `API_INTERNAL_URL`; `NEXT_PUBLIC_*` values are build arguments.
- Web without Docker: Next.js (`next build`/`next start`); the current
  workflow deploys to a VPS over SSH with PM2 (`.github/workflows/deploy-web.yml`).
- API: `node ace build`, then install production deps; in the monorepo use
  `pnpm deploy --filter @react-menu/api <dir>`. Run migrations on deploy.
- The auth cookie is host-only and `SameSite=Strict`: serve web and API from
  the same host (reverse proxy routing `/api` and `/__transmit` to the API)
  so `proxy.ts` can see the cookie. Disable proxy buffering for
  `/__transmit/events` (SSE).
- Health: `GET /health` with `x-monitoring-secret` (and optional IP allowlist).
