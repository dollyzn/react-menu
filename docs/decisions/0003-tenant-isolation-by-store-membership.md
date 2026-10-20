# 0003. Tenant isolation by store membership, closed staff signup

- Status: Accepted
- Date: 2026-10-20

## Context

Every authenticated user could read and modify any store, and public
`/auth/register` plus an unauthorized `/users` CRUD allowed anyone to sign
up and link themselves to any store or take over accounts. Bouncer was
installed but never used.

## Decision

- A store is the tenant. `store_user` links staff to stores (unique pair).
- `accessStore` ability: a user may act on a store if linked to it or a
  super user. Enforced for all `/stores/:storeId/*` routes by the
  `storeAccess` middleware, and reused to authorize realtime channels.
- Creating/deleting stores requires `create_store`/`delete_store`
  permissions (`StorePolicy`); the creator is linked to the new store.
- `/users` is protected by the existing permission-based `UserPolicy`.
- Staff registration is closed: accounts are created by admins. Menu
  customers will get a separate, lightweight identity (name + phone) with
  the ordering domain; they will not be rows in `users`.

## Alternatives considered

- **Per-store roles (owner/staff) now**: not needed until there are
  operations that differ by role inside a store; membership + global
  permissions cover today's screens.
- **Row-level security in Postgres**: strong, but a large change to the
  data layer and test setup for the current size.

## Consequences

- Repositories expose `...InStore` methods; new tenant data must follow.
- Existing users without a `store_user` row lose access until linked; the
  bootstrap admin is a super user to fix links.
