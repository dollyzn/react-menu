# apps/web (Next.js 16)

Read the root `AGENTS.md` first. This file only covers the web app.

## Where things go

| Concern | Location |
| --- | --- |
| Admin routes | `app/app/stores/[store]/<domain>/` (page + `components/`) |
| Operations | `…/orders` (board), `…/pos` (POS), `…/kitchen` (KDS), `…/inventory` |
| Auth pages | `app/app/(auth)/` |
| Customer menu (SSR) | `app/(menu)/` (`/`, `/[slug]`, `/pedido/[token]`), shared parts in `_components/` |
| Bag and customer identity | `redux/slices/cart.ts`, `redux/slices/customer.ts` (persisted) |
| Sidebar by role | `lib/menu-itens.ts` (`getManageMenuItems`, `homeForRole`) |
| Route guard (UX only) | `proxy.ts` (checks the auth cookie exists) |
| Server state | RTK Query: `redux/api/baseApi.ts`, `redux/features/<domain>/<domain>Api.ts` |
| Session / push | `contexts/session-provider.tsx`, `contexts/notification-provider.tsx` |
| Realtime | `lib/transmit.ts`, `hooks/use-store-realtime.ts`, `hooks/use-notifications-realtime.ts` |
| Design system (shadcn base-nova on Base UI) | `components/ui` (generated; change via shadcn CLI) |
| App components (data table, layout, dialogs) | `components/app` |
| Types | aliases of `@react-menu/contracts` in `@types/*.d.ts` and `types/*` |
| Env schema | `lib/env.ts` (+ `.env.example`) |

## Rules

- Server data goes through RTK Query with tags; mutations invalidate tags.
  Don't add new `request()` (axios) calls.
- Only a 401 means the session ended; 429/5xx/offline are transient.
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
- Forms: react-hook-form + zod + `Field*` components (see
  `create-category-dialog.tsx`); the API validation is authoritative.
- User-facing text is pt-BR, including `aria-label`s.

## Tests

Playwright in `e2e/` (`pnpm test:e2e` from the root). It starts the API on
:3334 against a recreated `jjpasteis-menu-e2e` database and Next on :3100.
Tests fail on any console warning/error and on unnamed controls.
