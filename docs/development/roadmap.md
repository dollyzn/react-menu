# Roadmap and known gaps

Known gaps and next steps, kept current. Items move to an ADR or a PR when
they are picked up; done items leave this file (see the git history).

## Next up (in order)

Manual testing of the current build comes first; then the next item is
picked from Product below, one PR at a time.

## Standby (decided not to do for now)

- **A second payment gateway** (Asaas, Pagar.me, Stripe…): we stay with
  Mercado Pago. `PaymentGateway` keeps the door open.

## Product

- **Customer verification**: customers identify with name + phone only;
  consider WhatsApp/SMS OTP if fake orders become a problem.
- **Reviews**: the 5-star rating on the menu and store page is an
  intentional placeholder for a future review system (not backed by data).
- **Notification preferences** (per category, email digest).
- **Delivery and table service**: only pickup at the counter is supported
  by design for now.

## Technical

- **Enforce the Content-Security-Policy.** The web sends it as
  `Content-Security-Policy-Report-Only` (`apps/web/lib/csp.ts`, nonce from
  `proxy.ts`); reports are logged by `/csp-report` (`docker compose logs web
  | grep csp-report`). Zod's `eval` probe, the only report so far, is gone
  since v1.0.1 (2026-11-07). After a few weeks of real traffic without
  unexpected reports (Mercado Pago Brick, 3-D Secure, push), switch the
  header to `Content-Security-Policy`.
- `@adonisjs/shield` and `@adonisjs/session` were looked at and left out:
  Shield's CSRF and CSP target pages the Adonis app renders (ours are the
  Next app's), and the login is an access token in an httpOnly cookie
  (cross-origin writes are refused by `#helpers/trusted_origin`).

- The API's OpenTelemetry only runs from the compiled build. Under
  `node ace serve` (TypeScript through `@poppinss/ts-exec`, with or without
  `--hmr`), the import-in-the-middle loader hook that `@adonisjs/otel`'s
  `init()` registers breaks the boot ("Cannot resolve binding "server" from
  the container"), and imported by `bin/console.ts` it breaks Ace's command
  loading ("Missing "export default" in module "mail_preview.js""), even with
  `enabled: false`. So `otel.ts` is preloaded only by the production commands
  (`node --import ./otel.js bin/server.js` / `ace queue:work` in the
  Dockerfile and compose) and `pnpm dev` sends nothing
  (docs/development/observability.md). Reported in
  [adonisjs/otel#27](https://github.com/adonisjs/otel/issues/27): it's a
  `@poppinss/ts-exec` regression since 1.5.0
  ([poppinss/ts-exec#12](https://github.com/poppinss/ts-exec/issues/12)),
  fixed in ts-exec **1.5.2** (2026-11-06). From ~2026-11-20 (our two-week
  rule for new versions): bump `@poppinss/ts-exec` to `^1.5.2`, check that
  `node ace serve` boots with `--import ./otel.js` and Ace commands load,
  then the dev scripts can preload it too (optional) and this note goes.
- Ace commands that end before Redis connects (e.g. `--help`) crash with
  "Connection is closed" (exit 1): `@boringnode/transmit` starts its bus
  `subscribe` with `void` and never catches it. Reported in
  [boringnode/bus#73](https://github.com/boringnode/bus/issues/73).
- Lucid runs a query's preloads in parallel; inside one transaction pg
  queues them and warns that pg 9 will refuse it. pg 9 isn't out; its
  major is ignored by Dependabot until Lucid supports it.
