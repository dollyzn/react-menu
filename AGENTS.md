# AGENTS.md

Instructions for AI coding agents (and humans) working in this repository.
This file is the single source of truth for conventions; `CLAUDE.md` and the
per-app `AGENTS.md` files only add scoped details. Architecture rationale
lives in `docs/architecture/` and `docs/decisions/` (ADRs).

## What this is

React Menu: digital menus for restaurants. Staff manage stores, categories,
items and add-ons in an admin app; customers browse a public menu. There is
**no ordering domain yet** (see `docs/development/roadmap.md`).

## Layout

```
apps/api            AdonisJS 6 REST API (Lucid/Postgres, Redis, VineJS, Bouncer, Transmit)
apps/web            Next.js 16 App Router admin + public menu (RTK Query, shadcn/ui on Base UI)
packages/contracts  Type-only API contracts shared by both apps
docs/               architecture/, decisions/ (ADRs), development/
```

pnpm workspace, no Turborepo. Node >= 24 (`.nvmrc`), pnpm via corepack.

## Commands (run from the repo root)

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev (both apps) | `pnpm dev` (or `pnpm dev:api`, `pnpm dev:web`) |
| Lint / typecheck | `pnpm lint` / `pnpm typecheck` |
| API tests (Japa) | `pnpm test` |
| E2E (Playwright) | `pnpm test:e2e` |
| All checks before a PR | `pnpm check` |
| Migrations / seed | `pnpm --filter @react-menu/api exec node ace migration:run` / `... db:seed` |

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
6. **Base UI, not Radix patterns.** Use the `render` prop (never `asChild`).
   A trigger that renders a non-`<button>` needs `nativeButton={false}`;
   prefer rendering a real `Button`. Icon-only controls need `aria-label`.
   The e2e suite fails on any browser console warning.
7. **No secrets in git.** `.env` files are ignored; add new variables to the
   relevant `.env.example` and to `apps/api/start/env.ts` / `apps/web/lib/env.ts`.

## How to add a feature (API → web)

1. Migration (`node ace make:migration`) and Lucid model in `app/models`.
2. VineJS validators in `app/validators` (validate params too).
3. Repository (queries, store scoping) → service (business rules,
   `db.transaction`) → controller (validate, authorize, call service,
   respond). Services/repositories are resolved via `@inject`; if the
   service is registered in `providers/di_provider.ts`, update it there too.
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

- `apps/web/lib/api.ts` (axios `request()`) is still used by the session and
  push providers; new code uses RTK Query.
- The public menu at `/` reads `app/data/categories.json`, not the API.
- See `docs/development/roadmap.md` for the full list.
