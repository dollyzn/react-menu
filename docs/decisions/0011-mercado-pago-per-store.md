# 0011. Online payment with Mercado Pago, per store

- Status: Accepted
- Date: 2026-10-20

## Context

Pickup orders should be payable online (Pix and card). Each store receives
the money in its own account.

## Decision

Mercado Pago Checkout Pro with each store's own Access Token and webhook
secret, stored encrypted with APP_KEY and never serialized. Online orders
start in `pending_payment` and enter the kitchen only after an approved
payment. Webhooks are verified by `x-signature` (HMAC-SHA256) and the
payment is fetched from Mercado Pago before trusting it; the order must
belong to the store of the webhook URL. If the checkout cannot be created
the order is cancelled. TEST- tokens use the sandbox. Paying at the counter
remains available per store.

## Alternatives considered

- **Platform-wide credentials (marketplace / OAuth)**: needed for a hosted
  multi-tenant SaaS with split payments; heavier onboarding. Revisit then.
- **Checkout Bricks / Pix QR in our UI**: better UX, more PCI and API
  surface; Checkout Pro is the smallest secure step.

## Consequences

- Refunds of cancelled paid orders are manual (logged as a warning).
- Each store must register the webhook URL shown in its settings.
