# Roadmap and known gaps

Known gaps and next steps, kept current. Items move to an ADR or a PR when
they are picked up; done items leave this file (see the git history).

## Next up (in order)

1. **Notification preferences** (in progress): per notification type, push
   and e-mail on/off for the whole account, and each store can be muted;
   a daily summary e-mail for managers (opt-in, per store: yesterday's
   sales and orders, best sellers, low stock); the notifications popover
   redesigned.

## Standby (decided not to do for now)

- **A second payment gateway** (Asaas, Pagar.me, Stripe…): we stay with
  Mercado Pago. `PaymentGateway` keeps the door open.
- **Customer verification**: customers identify with name + phone only;
  consider WhatsApp/SMS OTP if fake orders become a problem.
- **Delivery and table service**: only pickup at the counter, by design;
  not planned for this project.

## Product

- **Reviews**: the 5-star rating on the menu and store page is an
  intentional placeholder for a future review system (not backed by data).

## Technical

- **Enforce the Content-Security-Policy.** The web sends it as
  `Content-Security-Policy-Report-Only` (`apps/web/lib/csp.ts`, nonce from
  `proxy.ts`); reports are logged by `/csp-report` (`docker compose logs web
  | grep csp-report`). Zod's `eval` probe, the only report so far, is gone
  since v1.0.1 (2026-11-07). Once Mercado Pago is set up in production and
  a Pix and a card payment (Brick, 3-D Secure) went through without
  reports, plus a few weeks of real traffic, switch the header to
  `Content-Security-Policy`.
- Ace commands that end before Redis connects (e.g. `--help`) crash with
  "Connection is closed" (exit 1): `@boringnode/transmit` starts its bus
  `subscribe` with `void` and never catches it. Reported in
  [boringnode/bus#73](https://github.com/boringnode/bus/issues/73).
- Lucid runs a query's preloads in parallel; inside one transaction pg
  queues them and warns that pg 9 will refuse it. pg 9 isn't out; its
  major is ignored by Dependabot until Lucid supports it.
