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

- **Security review of the deploy** (hardening, nothing known broken):
  - API: refuse cookie-authenticated writes whose `Origin` (or
    `Sec-Fetch-Site`) isn't `FRONTEND_URL`. `SameSite=Lax` already blocks
    other sites; this also covers another subdomain of the same site.
  - Caddy: `Strict-Transport-Security` (with `includeSubDomains` once every
    subdomain is on HTTPS), plus `nosniff` and `Referrer-Policy` on the API's
    answers (the web already sends them).
  - Web: a nonce-based Content-Security-Policy, first as
    `Content-Security-Policy-Report-Only`. It must allow the Mercado Pago
    Brick and the 3-D Secure iframe, Firebase (push), Google sign-in and the
    API's images.
  - `@adonisjs/shield` and `@adonisjs/session` were looked at and left out:
    Shield's CSRF and CSP target pages the Adonis app renders (ours are the
    Next app's), and the login is an access token in an httpOnly cookie.

- The API's OpenTelemetry only runs from the compiled build: under
  `node ace serve` (TypeScript) its loader hook breaks the boot ("Cannot
  resolve binding server"). Worth reporting to adonisjs/otel with a minimal
  repro; then `pnpm dev` could send traces too (docs/development/observability.md).
- Ace commands that end before Redis connects (e.g. `--help`) crash with
  "Connection is closed" (exit 1): `@boringnode/transmit` starts its bus
  `subscribe` with `void` and never catches it. Reported in
  [boringnode/bus#73](https://github.com/boringnode/bus/issues/73).
- Lucid runs a query's preloads in parallel; inside one transaction pg
  queues them and warns that pg 9 will refuse it. pg 9 isn't out; its
  major is ignored by Dependabot until Lucid supports it.
