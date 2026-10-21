# 0016. Background jobs with @adonisjs/queue

- Status: Accepted
- Date: 2026-10-21

## Context

Some work must happen later or survive failures: online orders nobody pays
should be cancelled when their Pix expires, refunds must be retried when the
gateway is down, and web push should not depend on the request that
triggered it. Doing these inline (or fire-and-forget) loses them on errors
and restarts.

## Decision

- `@adonisjs/queue` (official, built on `@boringnode/queue`) with the Redis
  adapter. The package is 0.x, so the version is pinned in `package.json`.
- Jobs live in `app/jobs`, are resolved through the container (`@inject`)
  and carry only ids in their payload (they reload state when they run):
  - `ExpireUnpaidOrder`: scheduled when an online order is placed (40 min,
    deduplicated per order); a Pix or card still in progress postpones it.
  - `RefundOrder`: after cancelling a paid order, or when a Pix is paid
    after its order expired; retried with exponential backoff, then logged
    for a manual refund.
  - `SendPushNotification`: web push per user, retried.
- A separate worker process runs them: `pnpm dev` starts it, the
  production stack has a `worker` service (same image, no migrations).
- The queue uses its own Redis connection with the `react-menu:` key prefix:
  its key names are generic and Redis is often shared.
- Tests use the in-memory fake (`fakeQueue()`) and run jobs directly
  (`runJob()`); they never touch Redis.

## Alternatives considered

- **BullMQ (`@rlanz/bull-queue`)**: mature, but not updated for AdonisJS 7.
- **Database adapter**: no Redis dependency, but we already run Redis for
  rate limiting and realtime, and it is the recommended production adapter.
- **Cron sweeping unpaid orders**: simpler, but delayed per-order jobs are
  exact and cost nothing while there are no orders.

## Consequences

- One more process to run and monitor (the worker). Without it, orders still
  work; expiry, refunds and push wait until a worker runs.
- Upgrading `@adonisjs/queue` may need `node ace queue:migrate` with the
  workers stopped (see its upgrade notes).
- The Transmit Redis transport can throw "Connection is closed" when a
  very short-lived ace command exits before it connects; long-running
  processes (server, worker) shut down cleanly.
