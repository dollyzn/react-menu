# Roadmap and known gaps

Known gaps and next steps, kept current. Items move to an ADR or a PR when
they are picked up.

## Product

- **Staff management**: no API/UI to invite staff or set a member's store
  role (`store_user.role`); seeds and SQL do it today. `PUT /users/:id`
  with `storeIds` links users as managers. Needs a members screen per store.
- **Customer verification**: customers identify with name + phone only;
  consider WhatsApp/SMS OTP if fake orders become a problem.
- **Refunds**: cancelling a paid Mercado Pago order logs a warning; the
  refund is done manually in Mercado Pago.
- **Reviews**: the 5-star rating on the menu and store page is an
  intentional placeholder for a future review system (not backed by data).
- **Choice groups** ("queijo à sua escolha", min/max add-ons) are not
  modeled; today they are free add-ons or notes.
- **Reports**: sales per day/item, best sellers, stock consumption.
- **Password reset**: the login links to `/esqueci-minha-senha`, which does
  not exist.
- **Notification preferences** (per category, email digest).
- **Delivery and table service**: only pickup at the counter is supported
  by design for now.

## Technical

- Replace the remaining `apps/web/lib/api.ts` (axios) usage in the session
  provider with RTK Query, then drop axios.
- Sliding session renewal (tokens currently expire after 7 days).
- `GET /public/menu` writes one `store_views` row per customer visit;
  aggregate or sample before traffic grows.
- FCM: re-register when `onRegistered` reports a new installation ID; wrap
  `PushService` in an injectable client like Mercado Pago for tests.
- Several demo photo URLs from the original menu JSON now return 404
  (third-party hosts); replace them with uploaded images.
- Cookie domain is not configurable (`config/app.ts`); add an env var if web
  and API must live on different hosts.
- API deploy workflow (only the web app has one).
- Database names still carry the original client's name
  (`jjpasteis-menu*`); rename for a neutral open-source default.
- Many unused shadcn components in `apps/web/components/ui`; prune with a
  usage check.
- `providers/di_provider.ts` registers some services manually although
  `@inject` already resolves them.
