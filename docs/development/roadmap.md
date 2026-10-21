# Roadmap and known gaps

Known gaps and next steps, kept current. Items move to an ADR or a PR when
they are picked up; done items leave this file (see the git history).

## Next up (in order)

1. **Transactional e-mail with `@adonisjs/mail`** (sent by a job, ADR
   0016): password reset (the login links to `/esqueci-minha-senha`, which
   does not exist yet)
   and, optionally, the order receipt for customers who gave an e-mail at
   the Pix/card step.
2. **Staff management**: no API/UI to invite staff or set a member's store
   role (`store_user.role`); seeds and SQL do it today. `PUT /users/:id`
   with `storeIds` links users as managers. Needs a members screen per store.
3. **Payments, follow-ups of the in-app checkout (ADR 0015)**:
   - refund status and a "reembolsar" retry in the staff order detail
     (refunds that gave up are only logged today);
   - installments per store (the card form allows 1x today);
   - a second gateway (Asaas, Pagar.me, Stripe…) through `PaymentGateway`;
   - move `MercadoPagoGateway` to the Orders API (`/v1/orders`) once its
     rejection statuses, refunds and webhook signature are documented.
4. **TanStack Table 9**: a rewrite (`useReactTable` → `useTable`, a
   `features` registry, new types) touching 38 files; majors are ignored by
   Dependabot until then.

## Product

- **Customer verification**: customers identify with name + phone only;
  consider WhatsApp/SMS OTP if fake orders become a problem.
- **Reviews**: the 5-star rating on the menu and store page is an
  intentional placeholder for a future review system (not backed by data).
- **Choice groups** ("queijo à sua escolha", min/max add-ons) are not
  modeled; today they are free add-ons or notes.
- **Reports**: sales per day/item, best sellers, stock consumption, payment
  method mix (Pix vs card vs counter).
- **Notification preferences** (per category, email digest).
- **Delivery and table service**: only pickup at the counter is supported
  by design for now.
- **Store opening hours**: open/closed is a manual switch; schedule it.

## Technical

- Replace the remaining `apps/web/lib/api.ts` (axios) usage in the session
  provider with RTK Query, then drop axios.
- Sliding session renewal (tokens currently expire after 7 days).
- `GET /public/menu` writes one `store_views` row per customer visit;
  aggregate or sample before traffic grows.
- FCM: re-register when `onRegistered` reports a new installation ID; wrap
  `PushService` in an injectable client like Mercado Pago for tests.
- Queue observability: failed jobs are only logged; consider a small staff
  page (or alerts) listing failed jobs, and OpenTelemetry
  (`@adonisjs/queue/otel`) once there is a collector.
- e2e runs place jobs in the same Redis prefix as the dev worker (harmless:
  their orders don't exist in the dev database); give e2e its own prefix.
- Short ace commands that use Redis may print "Connection is closed" on
  exit (Transmit's Redis transport closing before it connected); report
  upstream to `@boringnode/bus`.
- Lucid runs a query's preloads in parallel; inside one transaction (the
  tests' global transaction, `findByToken`) pg queues them and warns that
  pg 9 will refuse it. Check Lucid's guidance before upgrading `pg` to 9.
- `testUtils.db().withGlobalTransaction()` is marked deprecated in Lucid 22;
  move the tests to its replacement.
- Cookie domain is not configurable (`config/app.ts`); add an env var if web
  and API must live on different hosts.
- Deploys: the "Deploy web to VPS" workflow (PM2, web only) fails on every
  push without its SSH secrets. Replace it with a Docker Compose deploy of
  the whole stack (README "Production"), or remove it.
- Database names still carry the original client's name
  (`jjpasteis-menu*`); rename for a neutral open-source default.
- Many unused shadcn components in `apps/web/components/ui`; prune with a
  usage check.
- `providers/di_provider.ts` registers some services manually although
  `@inject` already resolves them.
