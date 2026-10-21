# apps/web (Next.js 16)

Read the root `AGENTS.md` first. This file only covers the web app.

## Where things go

| Concern | Location |
| --- | --- |
| Admin routes | `app/app/(dashboard)/stores/[store]/<domain>/` (page + `components/`); `(dashboard)/layout.tsx` holds the shell; `(dashboard)/settings` |
| Panel shell | `components/app/layout/`: `app-sidebar` (store switcher, groups from `lib/menu-itens.ts`, account menu), `app-header` (breadcrumbs from the route, notifications), `page-header` |
| Operations | `…/orders` (board), `…/pos` (POS), `…/kitchen` (KDS), `…/inventory` |
| Auth pages | `app/app/(auth)/` |
| Customer menu (SSR) | `app/(menu)/` (`/`, `/[slug]`, `/pedidos`, `/pedido/[token]`), shared parts in `_components/`, helpers in `_lib/` |
| Customer history and device link | `_lib/customer-orders.ts`, `_components/order-history.tsx`, `customer.tokens` (ADR 0014) |
| Bag and customer identity | `redux/slices/cart.ts`, `redux/slices/customer.ts` (persisted) |
| Sidebar by role | `lib/menu-itens.ts` (`getManageMenuGroups`, `homeForRole`); new store sections also need a label in `app-breadcrumbs.tsx` |
| Route guard (UX only) | `proxy.ts` (checks the auth cookie exists) |
| Server state | RTK Query: `redux/api/baseApi.ts`, `redux/features/<domain>/<domain>Api.ts` |
| Session / push | `contexts/session-provider.tsx`, `contexts/notification-provider.tsx` |
| PWA (manifests, service worker, install prompt) | `app/manifest.ts`, `app/app/manifest.webmanifest/`, `public/sw.js`, `components/app/pwa/`, `hooks/use-pwa-install.ts` (ADR 0012) |
| Realtime | `lib/transmit.ts`, `hooks/use-store-realtime.ts`, `hooks/use-notifications-realtime.ts` |
| Design system (shadcn base-nova on Base UI) | `components/ui` (generated; change via shadcn CLI) |
| App components (data table, layout, dialogs) | `components/app` |
| Types | aliases of `@react-menu/contracts` in `@types/*.d.ts` and `types/*` |
| Env schema | `lib/env.ts` (+ `.env.example`) |

## Rules

- Server data goes through RTK Query with tags; mutations invalidate tags.
  Don't add new `request()` (axios) calls.
- Only a 401 means the session ended; 429/5xx/offline are transient.
- Mutations get an `Idempotency-Key` and automatic retries in `baseApi`.
  Anything a user may resubmit after a dropped connection (checkout, POS)
  passes a `stableIdempotencyKey(scope, payload)` and releases it on success
  (`lib/idempotency.ts`). Use `randomId()`, not `crypto.randomUUID()` (it
  fails on plain-http LAN testing).
- Images: import `Image` from `@/components/app/image` (lint-enforced), never
  `next/image`. Files from the API's `/uploads` skip the optimizer, the rest is
  optimized. Don't set a custom `images.loader`: it disables `/_next/image`.
  Stores without banner/logo show neutral placeholders.
- Base UI: `render` prop for composition; dialogs opened from menu items are
  controlled with state (`open`/`onOpenChange`) instead of nesting triggers;
  confirm destructive actions with `AlertDialogDestructive`.
- Dialogs: header and footer stay fixed and only `DialogBody` scrolls; put
  the form fields inside it (a `<form>` directly under `DialogContent` is
  `display: contents`, so header/body/footer can live inside the form).
  Never put `overflow` on `DialogContent` or use `scrollIntoView` for
  horizontal strips (it scrolls the window too; scroll the strip instead).
- Search fields use `components/app/search-input.tsx` (one clear button,
  Escape clears).
- Base UI `Select` shows the raw value in the trigger unless the root gets
  `items` (`[{ value, label }]`): always pass it.
- Data tables keep page, size, sorting and filters in the URL
  (`hooks/use-url-table-state.ts` via `useTableQuery`): reloads and shared
  links keep the view; filter/sort changes go back to page 1. When writing
  the URL yourself use `history.replaceState(null, …)`: Next only syncs
  `useSearchParams` for app-made entries, not its own state object.
- Never memoize JSX on the TanStack `table` object (same reference while its
  state changes): the UI freezes.
- Forms: react-hook-form + zod + `Field*` components (see
  `create-category-dialog.tsx`); the API validation is authoritative.
- User-facing text is pt-BR, including `aria-label`s.
- Theme changes go through `useThemeTransition` (circular reveal from the
  click); `ThemeSegmented` is the compact switch. Theme state is
  `@wrksz/themes` (not next-themes): the root `ThemeProvider` comes from
  `@wrksz/themes/next` in `app/layout.tsx`, hooks from `@wrksz/themes/client`.
- Never render a raw `<script>` in a component (React warns and never runs it
  on the client). Pre-hydration scripts go in `components/app/head-scripts.tsx`
  (`useServerInsertedHTML`).
- Error UI: `not-found.tsx` (root, `(menu)/[slug]` for unknown stores,
  `app/app` for the panel via the `app/app/[...missing]` catch-all),
  `error.tsx` (root and `(dashboard)`, inside the shell) and
  `global-error.tsx`, all built on `components/app/status-screen.tsx` /
  `route-error.tsx` (offline message, retries when the connection returns).
- Breadcrumb links: `BreadcrumbLink render={<Link href=… />}` (a plain href
  reloads the whole app).
- Navigation is a `<Link>` styled with `buttonVariants`, not `Button`
  `render={<Link/>}` (Base UI gives it role="button").
- Ingredient emoji use the `font-emoji` class (Noto Color Emoji), so they
  render on devices without an emoji font.

## Tests

Playwright in `e2e/` (`pnpm test:e2e` from the root). It starts the API on
:3334 against a recreated `jjpasteis-menu-e2e` database and Next on :3100.
Tests fail on any console warning/error, any image that answers 4xx/5xx, and
on unnamed controls.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
