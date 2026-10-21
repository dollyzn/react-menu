# apps/api (AdonisJS 7)

Read the root `AGENTS.md` first. This file only covers the API.

## Where things go

| Concern | Location |
| --- | --- |
| Routes (grouped by area) | `start/routes/*.ts`, composed in `start/routes.ts` |
| Middleware (named: `auth`, `storeAccess`) | `app/middleware`, registered in `start/kernel.ts` |
| Authorization | `app/abilities/main.ts` (`accessStore`), `app/policies/*` |
| Input validation (VineJS) | `app/validators/*` |
| HTTP layer | `app/controllers/*` (thin: validate, authorize, call service, respond) |
| Business rules, transactions | `app/services/*` |
| Queries, store scoping | `app/repositories/*` |
| Models / migrations / seeders | `app/models`, `database/migrations`, `database/seeders` |
| Responses / errors | `app/helpers/api_response.ts`, `app/exceptions/handler.ts` |
| Realtime channels | `app/helpers/realtime.ts` + authorization in `start/transmit.ts` |
| Notification templates | `app/notifications/templates.ts` |
| Orders (pricing, numbering, status machine) | `app/services/order_service.ts`, `app/orders/*` |
| Kitchen queue (pure batching + ingredients) | `app/kitchen/production_queue.ts`, `app/services/kitchen_service.ts` |
| Inventory (stock, recipes, consumption) | `app/services/inventory_service.ts` |
| Payments (in-app checkout, ADR 0015) | `app/services/payment_service.ts`, gateways in `app/payments/` (`gateway.ts`, `mercado_pago_gateway.ts`, `fake_gateway.ts`), attempts in `app/models/payment.ts` |
| Public customer API | `start/routes/public.ts`, `app/controllers/public_menu_controller.ts` |
| Demo data (development only) | `database/seeders/04-06_*` (JJ Pastéis, stock, staff); files in `database/data/` (banner, logo and Pexels menu photos go to the Drive disk; sources in `CREDITS.md`) |
| Store team (members, roles, invites) | `app/services/store_member_service.ts` (a store always keeps a manager), `start/routes/store/members.ts` (managers only); invites reuse `PasswordResetService.issueLink` and can be resent while `users.invite_pending` (cleared by setting a password or signing in); existing accounts get `store.member_added` + e-mail |
| Background jobs (ADR 0016) | `app/jobs/*` (`@inject`, payload with ids only, extend `AppJob`: a job that gives up notifies the super users), `config/queue.ts`, worker `node ace queue:work`; tests: `tests/helpers/queue.ts` (`fakeQueue`, `runJob`, `failJob`) |
| Social login (Google) | `app/controllers/social_auth_controller.ts` (existing, active accounts with a verified e-mail only), `#helpers/social_providers` (enabled = credentials in the env) |
| E-mail | `app/mails/*` (`BaseMail`, markup from `app/mails/layout.ts`), sent with `mail.sendLater` → `SendEmail` job (`start/mail.ts`); tests use `mail.fake()` |
| Idempotency (`Idempotency-Key`) | `app/middleware/idempotency_middleware.ts`, `orders.idempotency_key` (ADR 0013) |
| Env schema | `start/env.ts` (+ `.env.example`) |

Imports use subpath aliases (`#services/*`, `#models/*`, ...) declared in
`package.json`; add one there when creating a new folder.

## Rules

- Controllers never query models directly for tenant data; go through a
  service/repository method that takes `storeId`.
- Validate route params (`uuidValidator`, `storeExistValidator`), not only bodies.
- Wrap multi-step writes in `db.transaction`; broadcast/notify after commit.
- Money columns are `decimal(10,2)`.
- Lists use `parsePagination` + `pickQueryFilters` (+ `parseSort` with an
  allowlist of column ids; never order by a raw query value) and return
  `ok(paginator.all(), paginator.getMeta())` (snake_case meta).
- Rate limiting: `throttle` must run after `middleware.auth()` or the
  request is limited as a guest (per IP). Public order creation has its own
  `orderThrottle` (`PUBLIC_ORDER_RATE_LIMIT`).
- Decimal columns use `@column(decimal)` from `#helpers/columns` so values
  are numbers at runtime.
- Business dates use `BUSINESS_TIMEZONE` (America/Sao_Paulo), not UTC.
- Work that must happen later or be retried (expiry, refunds, push, mail)
  is a job, not a fire-and-forget promise. Dispatch after the transaction
  commits; deduplicate per entity (`.dedup({ id })`) when a retry of the
  request could dispatch it twice.
- External HTTP goes through an injectable client so tests can
  `app.container.swap()` it (`MercadoPagoClient`, `FcmClient`). Push is a
  no-op without FIREBASE_* credentials.

## Tests

Japa functional tests in `tests/functional`, using `.env.test`
(database `react-menu-test`) and `testUtils.db().wrapInGlobalTransaction()`.
Fixtures in `tests/helpers/fixtures.ts`; authenticate with `.loginAs(user)`.
Transmit only subscribes a `uid` with an open event stream: use
`openStream(cleanup)` from `tests/helpers/transmit.ts` in subscribe tests.
Every protected endpoint needs a test proving another store's member gets
403/404.
