# AGENTS.md

Instructions for AI coding agents (and humans) working in this repository.
This file is the single source of truth for conventions; `CLAUDE.md` and the
per-app `AGENTS.md` files only add scoped details. Architecture rationale
lives in `docs/architecture/` and `docs/decisions/` (ADRs).

## What this is

React Menu: digital menus and ordering for restaurants (pickup at the
counter). Customers order from the public menu (`/`, `/[slug]`) identified
only by name + phone and track the order live (`/pedido/[token]`). Staff
work by store role: managers run catalog, inventory and settings;
attendants use the POS, the orders board and the kitchen display; cooks use the kitchen
display, which batches identical pastries from nearby orders.

## Layout

```
apps/api            AdonisJS 7 REST API (Lucid/Postgres, Redis, VineJS, Bouncer, Transmit)
apps/web            Next.js 16 App Router admin + public menu (RTK Query, shadcn/ui on Base UI)
packages/contracts  Type-only API contracts shared by both apps
docs/               architecture/, decisions/ (ADRs), development/
```

pnpm workspace, no Turborepo. Node 24.22.1+ (`.nvmrc`; the October 2026 security release), pnpm via corepack.

`pnpm dev` runs the three processes with `concurrently`, which keeps the
terminal's stdin away from them: the Adonis dev server's keyboard shortcuts
(raw mode) would otherwise get it stopped by SIGTTOU. Use `pnpm dev:api`
alone for the shortcuts.

## Commands (run from the repo root)

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev (API, job worker and web) | `pnpm dev` (or `pnpm dev:api`, `pnpm dev:worker`, `pnpm dev:web`) |
| Lint / typecheck | `pnpm lint` / `pnpm typecheck` |
| API tests (Japa) | `pnpm test` |
| E2E (Playwright) | `pnpm test:e2e` |
| All checks before a PR | `pnpm check` |
| Migrations / seed | `pnpm --filter @react-menu/api exec node ace migration:run` / `... db:seed` |
| Dev databases (Docker) | `docker compose -f docker-compose.dev.yml up -d` |
| Production stack (Docker) | `docker compose up -d --build` (configure `.env` from `.env.docker.example`) |

Tests need Postgres and Redis reachable with `apps/api/.env`; see README.

## Non-negotiable rules

1. **Authorization is enforced in the API, always.** Every `/stores/:storeId/*`
   route runs `middleware.storeAccess()` (store membership or super user).
   Store-wide actions use `StorePolicy`, user management uses `UserPolicy`.
   New tenant-scoped data must be queried through the store (`...InStore`
   repository methods), never by id alone. UI permission checks
   (`lib/permissions.ts`) only hide buttons.
2. **Contracts are type-only.** Import `@react-menu/contracts` with
   `import type` only (lint-enforced). When an endpoint's shape changes,
   update the contract in the same change.
3. **Response envelope.** Success: `ok()`, `created()`, `updated()`,
   `messageOnly()`, `bulkDeleted()` from `#helpers/api_response`. Errors:
   throw (`AppException`, Vine validation, Bouncer, `firstOrFail`) and let
   `app/exceptions/handler.ts` answer. Never return `success: false` with 2xx.
4. **Realtime is a hint, not data.** Persist first, then broadcast
   (`#helpers/realtime`) after the transaction commits. Clients only
   invalidate queries on events and refetch after reconnecting. Every new
   channel must be authorized in `apps/api/start/transmit.ts`.
5. **Notifications** are declared as typed templates in
   `apps/api/app/notifications/templates.ts` and sent with
   `NotificationService.notify()` / `notifyStoreMembers()`.
6. **Orders are priced by the API.** Clients send item ids, quantities,
   add-on ids and notes only; `OrderService` computes prices from the
   current menu and snapshots names/prices. Status changes go through
   `OrderService` (state machine in `app/orders/order_state.ts`), never by
   updating `status` directly. Kitchen grouping lives in the pure
   `app/kitchen/production_queue.ts` (unit-tested).
7. **Store roles** (`manager | attendant | kitchen`, pivot `store_user.role`):
   guard routes with `managersOnly` / `frontOfHouse` from
   `start/routes/store/shared.ts` after `storeAccess`.
8. **Payments** go through `PaymentService` and a `PaymentGateway`
   (ADR 0015): Mercado Pago per store (credentials encrypted), or the
   development fake. Orders are paid on their tracking page (Pix QR code,
   card tokenized in the browser); card data never reaches the API.
   Webhooks are trusted only after the signature check and a server-side
   payment lookup. New providers implement `PaymentGateway`.
9. **Base UI, not Radix patterns.** Use the `render` prop (never `asChild`).
   A trigger that renders a non-`<button>` needs `nativeButton={false}`;
   prefer rendering a real `Button`. Icon-only controls need `aria-label`.
   The e2e suite fails on any browser console warning.
10. **SSR-safe client code.** Pages render on the server. Anything that
   depends on the browser (theme, persisted session/bag, `window`) must not
   change the first client render: use `useHydrated()` / `useRehydrated()`
   and `ThemeToggleButton` (never `ThemeTogglerButton` directly).
11. **Writes are idempotent** (ADR 0013). The API replays responses for a
   repeated `Idempotency-Key`; the web client sends one on every mutation and
   retries transient failures with it. Operations that create something the
   user may resubmit (orders) also persist the key, and repeating a state
   change already applied answers success. New endpoints must stay safe to
   repeat with the same key.
12. **No secrets in git.** `.env` files are ignored; add new variables to the
   relevant `.env.example` and to `apps/api/start/env.ts` / `apps/web/lib/env.ts`.

## How to add a feature (API → web)

1. Migration (`node ace make:migration`) and Lucid model in `app/models`.
2. VineJS validators in `app/validators` (validate params too).
3. Repository (queries, store scoping) → service (business rules,
   `db.transaction`) → controller (validate, authorize, call service,
   respond). Services/repositories are resolved by the container through
   `@inject` (no manual registration).
4. Route under `start/routes/` inside the right group (public, auth, or
   `/stores/:storeId` with `storeAccess`).
5. Functional test in `apps/api/tests/functional` covering the happy path
   **and** cross-store/unauthorized access.
6. Contract types in `packages/contracts`.
7. Web: endpoint in `redux/features/<domain>/<domain>Api.ts`
   (`baseApi.injectEndpoints`, tags for invalidation), UI in
   `app/app/stores/[store]/<domain>/`, reusing `components/app/data-table`
   and dialog patterns from existing CRUD screens.
8. E2E test if it is a critical flow.

## Commits and docs

Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `ci:`;
`!` for breaking changes). If you change a convention above or make a
decision that is hard to reverse, update this file and add an ADR in
`docs/decisions/`.

## Known debt (don't copy these patterns)

- See `docs/development/roadmap.md` for the full list.
