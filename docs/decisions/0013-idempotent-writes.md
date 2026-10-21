# 0013. Idempotent writes for unstable networks

- Status: Accepted
- Date: 2026-10-20

## Context

The shop runs on beach connections: a request often reaches the API but
the response is lost. Retrying blindly duplicated orders and counted
pastries twice in the kitchen; not retrying left staff guessing.

## Decision

Every write accepts an `Idempotency-Key` header (IETF draft "The
Idempotency-Key HTTP Header Field"), handled by `IdempotencyMiddleware` in
the router stack (before auth and throttle):

- Key scoped to the signed-in user (or anonymous) and the route; the
  first 2xx response is kept in Redis for 24 h and replayed with
  `Idempotent-Replayed: true`.
- Same key with another body: 422 `E_IDEMPOTENCY_KEY_REUSED`. A retry while
  the first attempt runs: 409 `E_IDEMPOTENCY_IN_PROGRESS` + `Retry-After`.
- Errors are not stored: their transaction rolled back, so running again is
  safe and may succeed later.

Order creation (public and POS) also stores the key in
`orders.idempotency_key` (unique per store), checked under the store row
lock, so duplicates are impossible even if Redis is flushed or the process
dies between commit and caching the response. A replayed Mercado Pago order
reuses its checkout.

State changes that are naturally idempotent answer success when repeated
("deliver" an already delivered order, cancel a cancelled one).

The web client sends a key with every mutation and retries transient
failures (offline, timeout, 502/503/504, in progress) with the same key and
backoff, waiting for the `online` event. Checkout and POS keep the key on
the device (`stableIdempotencyKey`) while the payload is unchanged, so a
second tap or reopening the app reuses it.

## Alternatives considered

- **Natural keys only** (e.g. dedupe by customer + items + minute): breaks
  legitimate repeat orders and does not cover kitchen marks or stock.
- **Postgres table for all keys**: survives Redis loss, but adds a write to
  every request; the critical path (orders) already has the database key.

## Consequences

New write endpoints get idempotency for free; endpoints with side effects
outside a transaction must keep them safe to repeat. Redis is required (it
already was for realtime). Tests: `apps/api/tests/functional/idempotency.spec.ts`
and `apps/web/e2e/flaky-network.spec.ts` (dropped response → one order).
