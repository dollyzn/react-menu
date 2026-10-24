# Roadmap and known gaps

Known gaps and next steps, kept current. Items move to an ADR or a PR when
they are picked up; done items leave this file (see the git history).

## Next up (in order)

Manual testing of the current build comes first; then these Product items,
one PR at a time:

1. Choice groups
2. Reports

## Standby (decided not to do for now)

- **A second payment gateway** (Asaas, Pagar.me, Stripe…): we stay with
  Mercado Pago. `PaymentGateway` keeps the door open.
- **Mercado Pago Orders API (`/v1/orders`)**: revisit when its rejection
  statuses, refunds and webhook signature are documented; the move stays
  inside `MercadoPagoGateway`.
- **TanStack Table 9**: a rewrite (`useReactTable` → `useTable`, a
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

## Technical

- Queue tracing: OpenTelemetry (`@adonisjs/queue/otel`) once there is a
  collector. Failed jobs already notify (super users; managers for refunds).
- Ace commands that end before Redis connects (e.g. `--help`) crash with
  "Connection is closed" (exit 1): `@boringnode/transmit` starts its bus
  `subscribe` with `void` and never catches it. Reported in
  [boringnode/bus#73](https://github.com/boringnode/bus/issues/73).
- Lucid runs a query's preloads in parallel; inside one transaction pg
  queues them and warns that pg 9 will refuse it. pg 9 isn't out; its
  major is ignored by Dependabot until Lucid supports it.
