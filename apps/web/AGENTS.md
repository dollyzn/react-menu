# apps/web (Next.js 16)

Read the root `AGENTS.md` first. This file only covers the web app.

## Where things go

| Concern | Location |
| --- | --- |
| Admin routes | `app/app/(dashboard)/stores/[store]/<domain>/` (page + `components/`); `(dashboard)/layout.tsx` holds the shell; `(dashboard)/settings` |
| Panel shell | `components/app/layout/`: `app-sidebar` (store switcher, groups from `lib/menu-itens.ts`, account menu), `app-header` (breadcrumbs from the route, notifications), `page-header`. The bell is `components/app/notifications/notifications-popover.tsx` (filter chips Todas / Não lidas / Pedidos / Lojas / Sistema, day groups, a tile per category, hover/focus actions that stay visible on touch screens, this device's push in the footer, a link to the preferences) |
| Store team | `…/members` (`member-row.tsx`: photo via `avatarUrl`, online dot and "Visto há…", badges for invite pending/expired, access off, e-mail not verified; actions menu: switch access off/on, end sessions, remove; the list refreshes every 30 s), add dialog (name, then e-mail, role); invites land on `/app/redefinir-senha?convite=1`. "Online" comes from `components/app/presence-heartbeat.tsx` in the dashboard layout (`GET /auth/presence` a minute while the tab is visible) |
| Operations | Kitchen (`…/kitchen`): the queue card grows into "Fazer agora" (shared `layoutId`) only on screens ≥1024px, where both are side by side; reduced motion is respected; no `backdrop-blur` inside the swipe card (costly while dragging on phones). `…/orders` (board; "Entregar" is `orders/deliver-order-button.tsx`: an order with items that skip the kitchen (`requiresPreparation: false`, drinks) asks first whether they were picked), `…/pos` (POS; with a card machine on, "Enviar e cobrar na maquininha" sends the ticket and opens `components/app/point/point-charge-dialog.tsx`: credit/debit/Pix as the store allows, installments, which machine, then follows the charge (poll 2 s, Mercado Pago check every 10 s) until approved, refused or cancelled; closing it loses nothing: `components/app/point/pending-charges-bar.tsx` ("Na maquininha", on the POS and the orders board) lists the waiting charges and opens them again (`resume`), and a busy machine (`E_TERMINAL_BUSY`) offers to cancel the other order's charge; the order card's menu has "Cobrar na maquininha" for unpaid orders; setup in the store page's `point-settings-card.tsx`; `redux/features/point/pointApi.ts`), `…/kitchen` (KDS), `…/inventory` (stock dialog with quick amounts for units) |
| Choice groups | panel `stores/[store]/option-groups/` (paginated `DataTable` with `renderCard`, dialog with `NumberStepper` for min/max, `groupRule` for the "Obrigatório · escolha 1" text), each option can have its own price in the group ("Mesmo preço para todas" + per-option `MoneyInput`, undo = the add-on's price), or the group prices by pick order ("Preço pela ordem da escolha": one price per pick up to the maximum, `pickPrices`; `lib/choice-pricing.ts` mirrors the API: picks priced in the order chosen, the option shows the next pick's price, "Pedir de novo" re-prices with `repriceByPick`), items pick them in their dialogs (`optionGroupIds`); `ItemCustomizer` (menu and POS) renders radios (max 1), capped checkboxes, or −/+ per option when the group `allowRepeat`s (picks keep repeats; `addonLabels` in `lib/addon-label.ts` prints "2× Queijo"), keeps required groups open and optional ones collapsed (the header shows the pick), and blocks "Adicionar" until required groups are filled. Bag/ticket add-ons carry `groupId`/`groupName` (`redux/slices/cart.ts`: `lineAddonsInput` builds `addonIds` + `choices`; `lib/addon-label.ts` prints "Recheio extra: Carne"); "Pedir de novo" puts group picks back in their group by name and skips items whose required choice is gone |
| Overview and reports (managers) | `…/overview` (today, live: `GET /dashboard/today`, refreshed by the store's realtime `Order` tag and a 1-min poll; pace vs the same weekday last week, queue, visits/conversion, stock and menu alerts), `…/reports` (`GET /reports/sales`; period in the URL `?de=&ate=` via `PeriodFilter` on the tables' `DateRangePicker`, `lib/report-period.ts` in BUSINESS_TIMEZONE; CSV with `lib/csv.ts`). Shared: `components/app/stat-tile.tsx` (`StatTile`, `Delta`, `Sparkline`), `components/app/ranked-list.tsx`. Charts: one series in `--primary` (validated in both themes), no legend for one series, a `sr-only` table under each chart |
| Opening hours | panel card `stores/[store]/components/opening-hours-card.tsx` (table Dia / Disponibilidade / Horas: "O dia todo" = 00:00–23:59, 30-min `TimeSelect`s), schedule-aware `store-status-dropdown.tsx`; menu hero/banner text and the "Horários" modal (`(menu)/_components/store-hours.tsx`, today highlighted after hydration; `lib/opening-hours.ts`: `formatWhen`, `dayHours`), `MenuView` refreshes itself when the store opens or closes |
| Stock limits in the menu and POS | `lib/stock.ts` (`unitsLeft`, `stockHint`: "Restam N" from `stockLeft`); `ItemCustomizer` caps the quantity (bag/ticket included); the API is authoritative |
| Auth pages | `app/app/(auth)/`; "Entrar com Google" (`login/components/social-login.tsx`, shown when `GET /auth/social/providers` lists it) opens `/app/social` in a popup (520×760, room for Google's consent without scrolling) that reports over a BroadcastChannel (`lib/social-auth.ts`), full page when popups are blocked or in the installed app. The popup can't be watched (Google's COOP makes it read as closed), so while it is open the e-mail form is locked and "Cancelar" or a 5-min timeout frees it; the page keeps listening, so a sign-in finished after "Cancelar" still enters |
| Settings (own account) | `(dashboard)/settings/page.tsx` in sections Conta / Segurança / Notificações (`#notificacoes`) / Preferências; `settings/components/`: `notification-preferences-card.tsx` (this device's push; push/e-mail switches per type grouped by category; mute per store; the managers' daily summary with its hour; every change saves at once with an optimistic update), `profile-card.tsx` (photo cropped square ≤512px via `compressImage(file, { maxSide, square })`, name, stores), `password-card.tsx`, `sessions-card.tsx` (device icon, "Este dispositivo", `timeAgo` from `lib/relative-time.ts`, revoke one or all others); `redux/features/account/accountApi.ts` (profile/photo writes put the returned user in the session); avatars everywhere through `lib/avatar.ts` (`avatarUrl`: the photo or a DiceBear one seeded by the name) |
| Two-factor sign-in | login: `login()` answers `{ twoFactor }` and `(auth)/login/components/two-factor-step.tsx` takes the code (e-mail or app; recovery code; "Confiar neste dispositivo"); Google's popup reports `{ type: "two-factor" }` (full page: `/app/login?etapa=codigo`) and the page reads the pending challenge (`GET /auth/two-factor`). `components/app/auth/code-input.tsx` (`CodeInput`): shadcn `input-otp` with animated slots, shake on error, paste keeps only digits. Settings: `settings/components/two-factor/` (card, setup dialog with QR via `qrcode.react` + key, recovery codes copy/download; the dialog stays mounted while enabling flips the card). `components/app/two-factor-prompt.tsx`: sidebar invitation (card when open, shield with a dot when collapsed), "Agora não" rests 7 days (`lib/two-factor-prompt-storage.ts`). e2e: `login()`/`apiSignIn()` in `e2e/fixtures.ts` read the code from the API's e2e hook |
| Legal pages | `app/(legal)/privacy`, `app/(legal)/terms` (linked from the login and the menu footer) |
| SEO | `app/robots.ts` (panel, orders and API disallowed), `app/sitemap.ts` (stores from `GET /public/stores`); per store: `_lib/store-seo.ts` (title, ≈160-char description that always keeps the call to action, canonical: the default store's `/<slug>` → `/`, Open Graph/Twitter), `(menu)/opengraph-image.tsx` + `[slug]/opengraph-image.tsx` (`_lib/store-og-image.tsx`: banner, logo, name in Geist from `public/fonts`; Satori has no `inset`), `_components/store-json-ld.tsx` (schema.org Restaurant + Menu with BRL prices). The panel and order pages are `noindex` |
| Item photo | `components/app/photo-field.tsx` (`PhotoField`: drop, paste, pick or camera; previews the 16:10 detail and the list thumbnail; staged as `PhotoChange` until the form saves, "Desfazer" goes back), `lib/image-compress.ts` (≤1600px WebP/JPEG, applies orientation, drops EXIF), saved after the item by `items/components/use-save-item-photo.ts` (`uploadItemPhoto` / `removeItemPhoto`) |
| Bulk edit of items/add-ons | `components/app/bulk-edit-dialog.tsx` (from the table's selection, preview before saving), math in `lib/bulk-pricing.ts` (sends absolute values); tables that act on selections pass `getRowId` |
| Login marquee | `public/login-marquee/*.webp`, regenerated by `e2e/marquee-screenshots.spec.ts` (`CAPTURE_MARQUEE=1`) |
| Customer menu (SSR) | `app/(menu)/` (`/`, `/[slug]`, `/pedidos`, `/pedido/[token]`), shared parts in `_components/`, helpers in `_lib/`. Mostly used on phones: no confirmation toasts there (they cover the bag bar); confirm on the control itself (the bag count bumps, `hooks/use-copied.ts` turns a copy button into "Copiado!", the stock limit shows on the bag line). Toasts stay for errors and for news the screen doesn't show (items left out of "Pedir de novo", an expired device link) |
| Checkout payment methods | `_lib/payment-methods.ts` (labels, `cardRejection`), `_components/payment-panel.tsx` (Pix, card) and `card-payment-form.tsx` (Card Payment Brick, loaded on demand; the SDK rebuilds the Brick when `initialization`, `customization` or a callback changes identity, so they are memoized and the callbacks read the latest props from a ref; colors from the app's tokens via `lib/mercado-pago-style.ts`, always the Brick's `default` theme with our variables; the font list ends in Arial for the card fields in Mercado Pago's iframes); 3-D Secure in `card-challenge.tsx` (the bank's page in an iframe; its `COMPLETE` message or "Já confirmei" calls `syncPayment`; ADR 0018) |
| Customer history and device link | `_lib/customer-orders.ts`, `_components/order-history.tsx`, `customer.tokens` (ADR 0014) |
| Bag and customer identity | `redux/slices/cart.ts`, `redux/slices/customer.ts` (persisted) |
| Sidebar by role | `lib/menu-itens.ts` (`getManageMenuGroups`, `homeForRole`); new store sections also need a label in `app-breadcrumbs.tsx` |
| Route guard (UX only) and CSP | `proxy.ts` (checks the auth cookie exists; sets `Content-Security-Policy-Report-Only` from `lib/csp.ts` with a per-request nonce in `x-nonce`, which Next and the root layout put on scripts: inline scripts take `nonce`; violations are logged by `app/csp-report/route.ts`). A new third-party script, frame, API or image host needs `lib/csp.ts` |
| Server state | RTK Query: `redux/api/baseApi.ts`, `redux/features/<domain>/<domain>Api.ts` |
| Server-side API calls (SSR, metadata, icons) | `lib/server-api.ts`: `serverApiBase()` (internal URL in Docker) and `visitorHeaders()` (forwards the visitor's IP so the API's per-IP limit counts them, not the server) |
| Panel shortcut on customer pages | `app/(menu)/_components/panel-shortcut.tsx` (staff signed in on the device; after rehydration) |
| Session / push | `contexts/session-provider.tsx`, `contexts/notification-provider.tsx` |
| Phone bar color (`theme-color`) | the page's background per theme (`lib/theme-colors.ts`); `components/app/theme-color-sync.tsx` (root layout) makes every `theme-color` tag follow the theme chosen on the site, not the system's (it reapplies when Next rewrites the head) |
| PWA (manifests, service worker, install prompt) | `app/manifest.ts` (default store), `app/(menu)/[slug]/manifest.webmanifest/` (other stores), `app/app/manifest.webmanifest/` (`?store=` from a store's panel), all via `customerManifest`/`lib/pwa-manifest.ts`; `public/sw.js`, `components/app/pwa/`, `hooks/use-pwa-install.ts` (ADR 0012) |
| Store icons (favicon, PWA) | `app/icons/store/[slug]/[file]/route.ts` renders the logo (sharp, on a white tile; no logo → the app's icons); URLs and metadata in `lib/store-icons.ts`, used by the menu pages (`_lib/store-metadata.ts`) and the store's panel layout |
| Realtime | `lib/transmit.ts`, `hooks/use-store-realtime.ts`, `hooks/use-notifications-realtime.ts` |
| Design system (shadcn base-nova on Base UI) | `components/ui` (generated; change via shadcn CLI) |
| App components (data table, layout, dialogs) | `components/app` |
| Types | aliases of `@react-menu/contracts` in `@types/*.d.ts` and `types/*` |
| Observability | `instrumentation.ts` (`@vercel/otel`, service `react-menu-web`, on only with `OTEL_EXPORTER_OTLP_ENDPOINT`; propagates `traceparent` only to the API's origin, so SSR and the API are one trace; a span processor masks order tracking tokens and OAuth codes in URLs; sampling from `OTEL_TRACES_SAMPLER(_ARG)`); see `docs/development/observability.md` |
| Env schema | `lib/env.ts` (+ `.env.example`) |

## Rules

- Every API call goes through RTK Query (`baseApi`), the session too
  (`redux/features/auth/authApi.ts`); mutations invalidate tags. Endpoints
  can pass `extraOptions`: `quiet` (the screen shows its own errors),
  `session` (a 401 is "signed out", not "expired"), `background`.
- Only a 401 means the session ended; 429/5xx/offline are transient.
  `GET /auth/me` renews a session that is past half its life (new cookie).
- Writes in flight hold navigation (`PendingWritesGuard` in the root
  layout, counter in `lib/pending-writes.ts`): reload/close asks, in-app
  links wait and continue when the save ends. Writes the user doesn't wait
  for (mark as read, push registration) pass `extraOptions: { background: true }`.
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
- Dialogs never change while they animate closed (it reads as a flicker).
  One opened from a piece of state (`open={Boolean(item)}`) renders from
  `useLastValue(item)` (`hooks/use-last-value.ts`), which keeps the last
  value until the next one. Forms and local state are cleared in
  `onOpenChangeComplete` (Base UI `Dialog`/`AlertDialog`, and
  `AlertDialogDestructive`/`ResponsiveModal`, which maps it to vaul's
  `onAnimationEnd`), never in `onOpenChange` or right before closing.
- The on-screen keyboard: the viewport has `interactive-widget=resizes-content`
  (app/layout.tsx), so on Android the page shrinks and bottom drawers/bars
  ride above the keyboard. vaul's own repositioning runs only on iOS
  (`components/ui/drawer.tsx`, a local change to the shadcn file: keep it
  when updating) — elsewhere it left drawers stuck up after the keyboard
  closed.
- Menus size to their items: `DropdownMenuContent` is `w-max`, at least the
  trigger's width (or 8rem) and at most the room on screen
  (`components/ui/dropdown-menu.tsx`, a local change to the shadcn file:
  keep it when updating). Give a menu a `min-w-*`, not a fixed `w-*`, so a
  long label doesn't wrap.
- Search fields use `components/app/search-input.tsx` (one clear button,
  Escape clears).
- Base UI `Select` shows the raw value in the trigger unless the root gets
  `items` (`[{ value, label }]`): always pass it.
- Data tables keep page, size, sorting and filters in the URL
  (`hooks/use-url-table-state.ts` via `useTableQuery`): reloads and shared
  links keep the view; filter/sort changes go back to page 1. When writing
  the URL yourself use `history.replaceState(null, …)`: Next only syncs
  `useSearchParams` for app-made entries, not its own state object.
- Tables are TanStack Table 9: features are registered in
  `components/app/data-table/features.ts` (an API exists only if its feature
  is there; client row models and `'auto'` filter/sort functions too) and
  table types come from that module (`ColumnDef<Item>`, `Row<Item>`, …,
  bound to those features; meta via `tableMeta`/`columnMeta`). Read state
  with `table.state` (reactive), never a snapshot (`table.store.state`,
  `atoms.*.get()`), and call row/column methods (`() => column.clearSorting()`):
  they live on prototypes and lose `this` when passed bare.
- Buttons inside table cells follow the row density: pass
  `size={cellButtonSize(table.options.meta?.density)}`
  (`components/app/data-table/density.ts`).
- Row actions that need page state (dialogs) go through a context the page
  provides, so `columns` stay module-level (see `inventory/components/ingredient-actions.tsx`).
- Forms: react-hook-form + zod + `Field*` components (see
  `create-category-dialog.tsx`); the API validation is authoritative.
  Small whole numbers use `components/app/number-stepper.tsx` (outline −/+
  around a regular `Input`), not a bare `type="number"`.
  Reset buttons ("Limpar", "Desfazer alterações") are enabled only when the
  form changed (`formState.isDirty`, plus a staged photo).
- shadcn conventions (the `.agents/skills/shadcn` rules): `flex flex-col gap-*`
  instead of `space-y-*` (prose like the legal pages is the exception);
  status colors are tokens (`text-success`, `bg-warning/10`, `text-destructive`;
  `--success`/`--warning` in `styles/globals.css`, >= 4.5:1 as text), never
  raw palette classes or `dark:` overrides (identity colors such as the POS
  category accents are the exception); `Spinner` for loading, `Kbd` for keys,
  `Toggle`/`ToggleGroup` for pressed state, `RadioGroup` for one-of choices
  (choice cards: `FieldLabel` > `Field` + `RadioGroupItem`; custom-looking
  options: Base UI `Radio.Root` inside `RadioGroup`), destructive menu items
  with `variant="destructive"`; icons inside components get no size classes.
  Components come from the CLI (`pnpm dlx shadcn@latest add …`, never
  `--overwrite`: `button.tsx` has the app's `loading`).
- User-facing text is pt-BR, including `aria-label`s.
- Theme changes go through `useThemeTransition` (circular reveal from the
  click); `ThemeSegmented` is the compact switch. Inside a view transition,
  always call `setTheme` (not only toggle the class): `@wrksz/themes` puts
  its stored theme back on `<html>` on the next frame. Theme state is
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
:3334 against a recreated `react-menu-e2e` database and Next on :3100.
Tests fail on any console warning/error, any image that answers 4xx/5xx, and
on unnamed controls.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
