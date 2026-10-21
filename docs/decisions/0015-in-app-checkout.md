# 0015. In-app checkout with payment gateways

- Status: Accepted
- Date: 2026-10-21

## Context

Checkout Pro (ADR 0011) sent customers to Mercado Pago and back. On a phone
at the beach that means a second site, a slow redirect and customers lost
on the way back. We also wanted to offer more than one provider in the
future and to refund cancelled paid orders without manual work.

## Decision

- **Methods are modules.** Customers choose `pix`, `card` or `counter`
  (`mercado_pago` stays only on older orders). The API lists what a store
  accepts (`store.paymentMethods`); the web maps each method to a panel
  (`app/(menu)/_lib/payment-methods.ts`, `payment-panel.tsx`).
- **Gateways behind an interface** (`app/payments/gateway.ts`):
  `createPix`, `createCard`, `fetch`, `refund`. `MercadoPagoGateway` uses
  the Payments API (Checkout Transparente) with the store's own credentials;
  `FakeGateway` is a local Pix for development (`PAYMENTS_FAKE_GATEWAY`,
  ignored in production).
- **The order is created first, paid next on its tracking page.** Online
  orders wait in `pending_payment`; each try is a `payments` row (method,
  status, Pix code and expiry). A valid Pix is reused on reloads and retries;
  a rejected card leaves the order payable with another card or Pix.
- **Card data never touches our servers**: the Card Payment Brick tokenizes
  it in Mercado Pago's iframe (store's public key); we receive a single-use
  token.
- Webhooks are still verified by signature and the payment is fetched from
  the gateway before trusting it. Gateway writes send an idempotency key
  derived from the browser's `Idempotency-Key` (ADR 0013).
- Cancelling a paid order refunds it automatically; a failed refund is
  logged for a manual one.
- The QR code is drawn in the browser from the Pix copy-and-paste code; we
  don't store Mercado Pago's PNG.

## Alternatives considered

- **Mercado Pago Orders API (`/v1/orders`)**: newer and recommended for new
  integrations, but its rejection statuses, refunds and webhook signature
  were not fully documented when we built this. The gateway interface keeps
  a migration contained in `MercadoPagoGateway`.
- **Payment Brick (all methods in one widget)**: less control over the Pix
  experience and the layout; the Card Payment Brick plus our own Pix panel
  fit the app better.
- **Keep Checkout Pro as an option**: removed to keep one flow; old pending
  orders now pay through the new panel.

## Consequences

- Mercado Pago requires the payer's e-mail for Pix; customers type it once
  (remembered on the device), only when paying online.
- Unpaid online orders stay in `pending_payment` until staff cancel them;
  expiring them automatically needs a scheduled job (roadmap: queues).
- A second provider means another `PaymentGateway` implementation and its
  webhook route; the checkout UI does not change.
