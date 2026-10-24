# 0017. Mercado Pago payments on the Orders API

- Status: Accepted
- Date: 2026-10-24

## Context

ADR 0015 built the in-app checkout (Pix and card) on Mercado Pago's
Payments API (`/v1/payments`) and kept the Orders API (`/v1/orders`) as an
alternative until its statuses, refunds and webhook signature were
documented. They now are: the order and transaction status tables (with the
card rejection reasons), `POST /v1/orders/{id}/refund`, and the "Order"
webhook topic signed like every other topic (the official Node SDK's
`WebhookSignatureValidator`). Mercado Pago recommends the Orders API for new
Checkout Transparente integrations.

## Decision

- `MercadoPagoGateway` creates one order per attempt (`type: online`,
  `processing_mode: automatic`, one payment transaction): Pix as
  `bank_transfer` with an ISO 8601 `expiration_time` (30 minutes, the
  minimum), cards with the Brick's token and `credit_card`/`debit_card`. The
  order id (`ORD…`) is the attempt's `gatewayPaymentId`.
- Order status → attempt: `processed` approved; `created`/`processing`/
  `action_required` pending; `failed` rejected (`expired` detail: expired);
  `canceled`/`expired` expired; `refunded`/`charged_back` refunded. The
  attempt's `statusDetail` is the transaction's (`rejected_by_issuer`,
  `insufficient_amount`…), which the menu turns into a message.
- A refused card answers HTTP 402 with the order: a result, not an outage.
- Refunds are `POST /v1/orders/{id}/refund` with no amount (full).
- Attempts created before the switch keep their numeric Payments API ids;
  fetch and refund route by the id's shape, and the webhook still accepts
  the `payment` topic for them.
- Checkout Transparente orders have no per-order `notification_url` (an
  unknown field is a 400): each store's Mercado Pago application must
  subscribe the webhook URL to the "Order (Mercado Pago)" event, besides
  "Pagamentos" for older attempts. The payment settings say so.
- Signatures follow the SDK (`id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
  missing parts omitted); `data.id` is read from the query and accepted as
  sent or in lowercase (older docs asked for lowercase).

## Consequences

- Stores already configured must also tick "Order (Mercado Pago)" in their
  webhook settings, or Pix approvals only show up when the tracking page
  polls the payment.
- Orders reject test credentials: testing in Mercado Pago's sandbox uses
  production credentials of test accounts. Local development keeps the fake
  gateway (`PAYMENTS_FAKE_GATEWAY`).
- 3-D Secure challenges (`action_required`/`pending_challenge`) are not
  handled yet: such a card stays pending until it expires.
