# Roadmap and known gaps

Known gaps and next steps, kept current. Items move to an ADR or a PR when
they are picked up; done items leave this file (see the git history).

## Next up (in order)

The technical items below, one PR at a time.

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
- **Team**: notify a person when they are added to a store (in-app and
  e-mail for existing accounts); resend an invite whose link expired
  (today: remove and add again, or "Esqueci minha senha").
- **Order receipt by e-mail** for customers who typed an e-mail at the
  Pix/card step (the mail pipeline exists since the password reset).
- **Delivery and table service**: only pickup at the counter is supported
  by design for now.
- **Store opening hours**: open/closed is a manual switch; schedule it.

## Technical

- Queue tracing: OpenTelemetry (`@adonisjs/queue/otel`) once there is a
  collector. Failed jobs already notify (super users; managers for refunds).
- Short ace commands that use Redis may print "Connection is closed" on
  exit (Transmit's Redis transport closing before it connected); report
  upstream to `@boringnode/bus`.
- Lucid runs a query's preloads in parallel; inside one transaction pg
  queues them and warns that pg 9 will refuse it. pg 9 isn't out; its
  major is ignored by Dependabot until Lucid supports it.
