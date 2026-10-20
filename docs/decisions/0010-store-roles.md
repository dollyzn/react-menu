# 0010. Roles inside a store

- Status: Accepted (extends 0003)
- Date: 2026-10-20

## Context

Membership alone (0003) let every member edit the catalog. The shop floor
has three jobs: running the store, serving the counter, cooking.

## Decision

`store_user.role` is `manager | attendant | kitchen` (existing links became
managers). A `hasStoreRole` ability and `storeRole` middleware, applied after
`storeAccess`: catalog, inventory, settings and dashboard changes are
manager-only; POS, handing over, cancelling and opening/closing the store
are front of house (manager, attendant); every member can read the catalog
and mark kitchen progress. Super users act as managers. The web app adapts
navigation and landing page to the role.

## Alternatives considered

- **Global permissions only** (roles table): permissions are per user, not
  per store; a cook at one store could manage another.
- **Fine-grained capabilities per store**: unnecessary for three jobs.

## Consequences

- There is no API/UI yet to set a member's role; seeds and SQL do it (see
  roadmap). `PUT /users/:id` with `storeIds` links users as managers.
