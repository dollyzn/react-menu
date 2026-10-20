# Architecture Decision Records

Decisions that are hard to reverse or that shape how code is written.
Add a new file `NNNN-short-title.md` using the template below; never rewrite
an accepted ADR, supersede it with a new one.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-monorepo-pnpm-workspaces.md) | Monorepo with pnpm workspaces, no Turborepo | Accepted |
| [0002](0002-session-opaque-tokens-in-httponly-cookie.md) | Sessions: opaque access tokens in an httpOnly cookie | Accepted |
| [0003](0003-tenant-isolation-by-store-membership.md) | Tenant isolation by store membership, closed staff signup | Accepted |
| [0004](0004-realtime-with-transmit-sse.md) | Realtime with Transmit (SSE) instead of Socket.IO | Accepted |
| [0005](0005-type-only-contracts-package.md) | Type-only shared contracts package | Accepted |
| [0006](0006-persisted-notifications-with-typed-templates.md) | Persisted notifications with typed templates | Accepted |
| [0007](0007-e2e-tests-fail-on-console-warnings.md) | E2E tests fail on browser console warnings | Accepted |
| [0008](0008-web-push-with-fcm-installation-ids.md) | Web push with FCM, addressed by installation ID | Accepted |
| [0009](0009-orders-kitchen-batching-and-inventory.md) | Orders, kitchen batching and recipe-based inventory | Accepted |
| [0010](0010-store-roles.md) | Roles inside a store | Accepted |
| [0011](0011-mercado-pago-per-store.md) | Online payment with Mercado Pago, per store | Accepted |

## Template

```md
# NNNN. Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD

## Context
## Decision
## Alternatives considered
## Consequences
```
