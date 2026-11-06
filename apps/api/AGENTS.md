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
| Inventory (stock, recipes, consumption) | `app/services/inventory_service.ts`: `capacities` (units each item/add-on still makes → `stockLeft` in the public menu), `assertStock` (the whole order against the stock, ingredients locked; on order creation and again before charging an online payment, 422 `E_OUT_OF_STOCK`) |
| Payments (in-app checkout, ADR 0015/0017) | `app/services/payment_service.ts`, gateways in `app/payments/` (`gateway.ts`, `mercado_pago_gateway.ts` on the Orders API: one `ORD…` order per attempt, older numeric Payments API ids still fetched/refunded there; `mercado_pago_client.ts` (a refused card is a 402 with the order), `fake_gateway.ts`), attempts in `app/models/payment.ts`; webhook topics `order` and `payment`, signed like the official SDK; cards ask for 3-D Secure (ADR 0018: `challenge_url` + 40-min `expires_at` on the attempt, `POST /public/orders/:token/payments/sync` reads it again after the challenge) |
| Public customer API | `start/routes/public.ts`, `app/controllers/public_menu_controller.ts` |
| Demo data (development only) | `database/seeders/04-07_*` (JJ Pastéis, stock, staff, choice groups); files in `database/data/` (banner, logo and Pexels menu photos go to the Drive disk; sources in `CREDITS.md`) |
| Choice groups ("Escolha o queijo", "Recheio extra") | `app/models/option_group.ts` (options = the store's add-ons, pivot `order` and `price`: the option's price in this group, null = the add-on's own, read with `optionPrice`; serialized as `groupPrice`), `app/services/option_group_service.ts`, `/stores/:id/option-groups` (writes: managers; body `options: [{ addonId, price }]`), items take `optionGroupIds`. Order lines send `choices: [{ groupId, addonId }]` for group picks and `addonIds` for free add-ons (an id there that is only a group option goes to the first group offering it: bags saved before choices). `OrderService.priceLines` enforces each group's min/max (422 `E_CHOICE_REQUIRED`), prices picks with the group's price and snapshots `order_item_addons.group_name` ("Recheio extra: Carne" via `addonLabel` in the kitchen, e-mails and tickets); the public menu lists options at the group's price and marks an item unavailable when a required group has too few options left. Demo groups: `database/seeders/07_demo_choice_groups_seeder.ts` |
| Reports and overview (managers) | `app/services/report_service.ts` (`GET /stores/:id/reports/sales?from&to`, business days, up to 366: sales exclude `pending_payment` and `cancelled`; previous period of the same length; daily/hourly, items, add-ons, payments, channels, net stock consumption), `app/services/dashboard_service.ts` (`GET /stores/:id/dashboard/today`: today vs the same weekday last week up to now, queue, prep time, visits from `store_view_counts`, low stock, menu health) |
| Opening hours | `#helpers/opening_hours` (pure: intervals per weekday in BUSINESS_TIMEZONE, past midnight belongs to the opening day; `availability`), `Store.isOpen`/`closesAt`/`opensAt` (computed), `PUT /stores/:id/hours`; on a schedule, status "closed" sets `closed_until` (until the end of the opening) and online orders follow `isOpen` (the POS doesn't) |
| Store team (members, roles, invites, access) | `app/services/store_member_service.ts` (a store always keeps an active manager), `start/routes/store/members.ts` (managers only); invites reuse `PasswordResetService.issueLink` and can be resent while `users.invite_pending` (cleared by setting a password or signing in; the list shows the link's expiry); existing accounts get `store.member_added` + e-mail. Access per store: `PUT /members/:userId/access` sets `store_user.disabled_at` (role kept) and ends the person's sessions; every membership check skips disabled rows (`User.hasStoreAccess`/`storeRole` via `whereNullPivot`, the session's `stores`, `notifyStoreMembers`), so a new membership query must too. `DELETE /members/:userId/sessions` ends sessions only. Neither applies to yourself or to super users. Signing in needs an active account and at least one store not switched off (`AuthService.signInBlocker`, checked after the password/Google and again after the code; `E_NO_STORE_ACCESS`), unless super user; `/auth/me` ends a session left without stores, and removing someone from their last store ends their sessions. API tests that sign in use `createStaff()`. Presence: `AuthMiddleware` records `users.last_seen_at` (`#helpers/user_activity`, throttled to a write a minute; `GET /auth/presence` is the panel's heartbeat), online = seen in the last 2.5 min. `users.email_verified_at` is set by a reset/invite link, an e-mail sign-in code, or Google with a verified address (`markEmailVerified`) |
| Background jobs (ADR 0016) | `app/jobs/*` (`@inject`, payload with ids only, extend `AppJob`: a job that gives up notifies the super users), `config/queue.ts`, worker `node ace queue:work`; tests: `tests/helpers/queue.ts` (`fakeQueue`, `runJob`, `failJob`) |
| Account (own profile, photo, password, sessions) | `app/services/account_service.ts`, `/account/*` (`start/routes/account.ts`, any signed-in user): `GET /sessions` (valid tokens with browser/OS/device from the user agent, IP, `signedInAt`, `lastActiveAt`, `current`), `DELETE /sessions/:id` (not the current one: that's "Sair") and `DELETE /sessions` (all others), `PUT /profile` (name), `PUT/DELETE /avatar` (Drive prefix `avatars/`, old file deleted), `PUT /password` (current password checked and rate limited; ends the other sessions). Sessions last `SESSION_TTL` (14 days) and `/auth/me` renews them in their second half; `AuthService.createSession` stores `user_agent`, `ip_address` and `signed_in_at` (kept on renewal) on the token row |
| Two-factor sign-in (always on) | `app/services/two_factor_service.ts`: after the password (`AuthService.login`) or Google (`SocialAuthController.callback`), `afterFirstFactor` opens a challenge (`login_challenges`, token in the httpOnly cookie `two_factor_challenge`, 10 min, 5 attempts) instead of a session: a 6-digit e-mail code (HMAC with APP_KEY, `SignInCodeNotification`, resend after 60 s, up to 5) until the user sets up an authenticator app (TOTP via `otpauth`: `users.two_factor_secret` encrypted, `two_factor_last_step` so a code works once, ±1 step). `POST /auth/two-factor` (`code`, `recovery`, `remember`) starts the session; `remember` creates a `trusted_devices` row + 30-day cookie `trusted_device` that skips the step for that user; tokens keep `trusted_device_id`, so ending a session (or "sair dos outros", or a password change elsewhere) ends its trust. `GET /auth/two-factor` describes the pending challenge (after Google), `POST /auth/two-factor/resend`. Per user: 10 challenges per 15 min (`E_TWO_FACTOR_TOO_MANY`) and 10 wrong codes per hour across challenges; resend never unlocks a locked challenge and runs under a row lock; a TOTP step is claimed with a conditional update. Answers with secrets or sign-in cookies call `noStore()` (`#helpers/api_response`), which the idempotency middleware never stores. A password reset also forgets trusted devices and pending challenges. Passwords asked again (change password, turn the app on/off) go through `#helpers/own_password` (one 5-per-15-min limit). `/account/two-factor`: status, `setup` (needs the password; pending secret + otpauth URI), `enable` (first code → 10 recovery codes, hashed, single use), `disable` (password; forgets trusted devices), `recovery-codes` (new set, needs a code). e2e: `E2E_TEST_HOOKS` keeps the last code per e-mail in memory for `GET /api/v1/__e2e/two-factor-code` (refuses to boot in production); API tests read it from `mail.fake()` (`tests/helpers/sign_in.ts`) |
| Social login (Google) | `app/controllers/social_auth_controller.ts` (existing, active accounts with a verified e-mail only), `#helpers/social_providers` (enabled = credentials in the env). `GET /auth/social/:provider/redirect` is navigated to (popup or page) and answers a 302: only Ally's `redirect()` stores the CSRF state cookie the callback checks (`redirectUrl()` leaves it out, and every callback would read as expired); both end on the web's `/app/social` (`?error=` when it failed) |
| E-mail | `app/mails/*` (`BaseMail`; content as blocks rendered by `app/mails/layout.ts` in the panel's look, light and dark (`prefers-color-scheme` + Outlook's `[data-ogsc]`), colors copied from `apps/web/styles/globals.css`: paragraph, button, callout, details, items; `storeBrand(store)` puts the store's name/logo/address on it), sent with `mail.sendLater` → `SendEmail` job (`start/mail.ts`) through `MAIL_MAILER`: `smtp` (default, Mailpit in development) or `resend` (Resend's HTTP API, `RESEND_API_KEY`; the API refuses to boot without the key); `node ace mail:preview` renders every template to `tmp/mail-previews`; tests use `mail.fake()` |
| Customer receipts | `SendOrderReceipt` job (dispatched when a payment is approved, once per payment via `payments.receipt_sent_at`), refund notice at the end of `PaymentService.refundCancelled`; both go to `payments.payer_email` |
| Item photos | `PUT/DELETE /stores/:id/items/:itemId/photo` (managers; multipart `photo`, jpg/png/webp up to 5 MB, the panel sends WebP ≤1600px) → `ItemService.setPhoto/removePhoto`; files under the Drive prefix `items/`, and only those are deleted (`#helpers/uploads`: on replace, remove and item delete; seeded `menu/` photos are shared). Items no longer take `photoUrl` in their body. A missing file under `/uploads` answers 404 (handler) |
| Bulk edit (prices, availability) | `POST /stores/:id/items|addons/bulk-update` → `#helpers/bulk_update` (`applyBulkChanges`): final values + the `updatedAt` the client saw, all or nothing, 409 `E_STALE_ROWS` with `details.ids`; rows are locked and saved in the same transaction |
| Idempotency (`Idempotency-Key`) | `app/middleware/idempotency_middleware.ts`, `orders.idempotency_key` (ADR 0013) |
| Observability (OpenTelemetry) | `otel.ts`, preloaded only by the production commands (`node --import ./otel.js bin/server.js` / `ace queue:work` in the Dockerfile and compose) and only with `OTEL_EXPORTER_OTLP_ENDPOINT` in the process environment (its hook breaks `node ace serve`, adonisjs/otel#27); `#helpers/otel` (`otelRunning()`, `redactUrl`); `#providers/otel_provider` and the OTel middleware in `start/kernel.ts` load only when it runs; `config/otel.ts` (`react-menu-api` / `react-menu-worker`, sampling, ignored URLs, tracking tokens and OAuth codes masked in URLs, `@adonisjs/queue/otel`). `AuthMiddleware` tags `user.id` (`setUser`), `StoreAccessMiddleware` tags `store.id`; the exception handler doesn't mark 4xx as span errors. Grafana Cloud in production, `grafana/otel-lgtm` locally: `docs/development/observability.md` |
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
  `ok(paginator.all(), paginator.getMeta())` (camelCase meta: `total`, `perPage`, `currentPage`…).
- Rate limiting: `throttle` must run after `middleware.auth()` or the
  request is limited as a guest (per client IP, `PUBLIC_RATE_LIMIT`, default
  120/min). `request.ip()` is the client's: X-Forwarded-For is trusted from
  local/private proxies only (`#helpers/trusted_proxy`: Caddy, the web's
  SSR), so customers behind the same proxy don't share one bucket. Public order creation has its own
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
