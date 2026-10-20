# Roadmap and known gaps

Found during the 2026-10 architecture audit and not implemented on purpose
(out of scope, or needing a product decision). Keep this list current.

## Product

- **Ordering domain** (orders, status transitions, kitchen/attendant views).
  Customers identify with name + phone only (no account, separate from
  `users`); consider OTP later to limit fake orders. Realtime order events
  fit the existing Transmit + notifications design.
- **Public menu wired to the API**: `/` still renders
  `apps/web/app/data/categories.json`; `GET /stores/:storeId/menu` exists
  but is unused. `app/m/[slug]` and `app/m/pedido` are empty placeholders.
- **Reviews**: the 5-star rating on the store page (`CommentRatings
  rating={5}`) is an intentional placeholder kept for a future review
  system; it is not backed by data.
- **Item availability** (out of stock) and add-on rules (min/max) are not modeled.
- **Users and permissions UI**: the API exists (`/users`), there is no screen.
- **Password reset**: the login links to `/esqueci-minha-senha`, which does
  not exist.
- **Onboarding**: a user with no linked store is redirected to the public
  menu instead of an empty state.
- **Notification preferences** (per category, email digest).
- **FID rotation**: re-register when `onRegistered` reports a new
  installation ID (today the server prunes dead FIDs and the user re-enables push).

## Technical

- Replace `apps/web/lib/api.ts` (axios) with RTK Query endpoints for auth
  and push; then drop axios.
- Sliding session renewal (tokens currently expire after 7 days).
- `GET /stores/:storeId/menu` writes one `store_views` row per request;
  aggregate or sample before traffic grows.
- Cookie domain is not configurable (`config/app.ts`); add an env var if web
  and API must live on different hosts.
- API deploy workflow (only the web app has one).
- Database names still carry the original client's name
  (`jjpasteis-menu*`); rename for a neutral open-source default.
- Many unused shadcn components in `apps/web/components/ui` and some
  possibly unused dependencies; prune with a usage check.
- `StoreService` and others are registered manually in
  `providers/di_provider.ts` although `@inject` already resolves them.
