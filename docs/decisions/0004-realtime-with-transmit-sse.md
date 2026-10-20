# 0004. Realtime with Transmit (SSE) instead of Socket.IO

- Status: Accepted
- Date: 2026-10-20

## Context

Socket.IO served one server→client event (store status), with
unauthenticated rooms anyone could join, emitted from a model hook before
the transaction committed. Transmit was installed but unused.

## Decision

Use Transmit (Server-Sent Events) for all realtime: routes require auth,
each channel is authorized in `start/transmit.ts` (`stores/:id` by store
membership, `users/:id/notifications` by ownership), events are broadcast
from services after commit, a 30s ping keeps connections alive behind
proxies, and Redis pub/sub fans out across API instances.

Events are refetch hints: clients invalidate RTK Query tags on events and
after reconnecting, so missed events are recovered over HTTP.

## Alternatives considered

- **Keep Socket.IO**: bidirectional transport is unnecessary; it was a second
  stack to secure. Re-introduce WebSockets only for a real client→server
  realtime need.
- **Polling**: simpler but laggy and wasteful for order/status updates.

## Consequences

- One realtime stack, authenticated with the same cookie as HTTP.
- SSE needs proxies to allow long-lived responses (no buffering).
