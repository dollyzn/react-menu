# 0014. Customer order history across devices without accounts

- Status: Accepted
- Date: 2026-10-21

## Context

Customers identify with name and phone only (anota.ai style, no account).
They want to see past orders and follow live ones, also on another phone.
Listing orders "by phone" would let anyone who knows a number see someone
else's orders (names, items, times).

## Decision

- Each device keeps the public tokens of the orders it placed and refreshes
  them through `GET /public/orders?tokens=` (tokens are unguessable).
- The device that places a customer's first order (per store) receives a
  random `customerToken` (only its SHA-256 is stored, issued with a
  conditional update so two first orders can't overwrite each other).
  Sending it as `Customer-Token` lists every order of that customer
  (`GET /public/menu/:slug/my-orders`) and keeps it on later orders.
- Another device joins by opening `/pedidos?vincular=<store>.<token>`,
  shared from "Usar em outro aparelho". A device that only knows the phone
  gets no token. A 401 makes the app drop the link quietly.

## Alternatives considered

- **OTP by SMS/WhatsApp**: proves the phone, but costs money per message
  and needs a provider; can be added later on top of the same token.
- **History by phone number**: rejected, leaks orders.

## Consequences

Losing every linked device loses access to older orders (the shop still
has them). The link is a bearer secret: the UI says to send it only to
oneself. Tests: `apps/api/tests/functional/customer_history.spec.ts`,
`apps/web/e2e/order-history.spec.ts`.
