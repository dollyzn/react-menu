# apps/api (AdonisJS 6)

Read the root `AGENTS.md` first. This file only covers the API.

## Where things go

| Concern | Location |
| --- | --- |
| Routes (grouped by area) | `start/routes/*.ts`, composed in `start/routes.ts` |
| Middleware (named: `auth`, `storeAccess`) | `app/middleware`, registered in `start/kernel.ts` |
| Authorization | `app/abilities/main.ts` (`accessStore`), `app/policies/*` |
| Input validation (VineJS) | `app/validators/*` |
| HTTP layer | `app/controllers/*` (thin: validate, authorize, call service, respond) |
| Business rules, transactions | `app/services/*` |
| Queries, store scoping | `app/repositories/*` |
| Models / migrations / seeders | `app/models`, `database/migrations`, `database/seeders` |
| Responses / errors | `app/helpers/api_response.ts`, `app/exceptions/handler.ts` |
| Realtime channels | `app/helpers/realtime.ts` + authorization in `start/transmit.ts` |
| Notification templates | `app/notifications/templates.ts` |
| Env schema | `start/env.ts` (+ `.env.example`) |

Imports use subpath aliases (`#services/*`, `#models/*`, ...) declared in
`package.json`; add one there when creating a new folder.

## Rules

- Controllers never query models directly for tenant data; go through a
  service/repository method that takes `storeId`.
- Validate route params (`uuidValidator`, `storeExistValidator`), not only bodies.
- Wrap multi-step writes in `db.transaction`; broadcast/notify after commit.
- Money columns are `decimal(10,2)` serialized with `Number.parseFloat`.
- Lists use `parsePagination` + `pickQueryFilters` and return
  `ok(paginator.all(), paginator.getMeta())` (snake_case meta).
- Rate limiting: `throttle` must run after `middleware.auth()` or the
  request is limited as a guest (per IP).

## Tests

Japa functional tests in `tests/functional`, using `.env.test`
(database `jjpasteis-menu-test`) and `testUtils.db().withGlobalTransaction()`.
Fixtures in `tests/helpers/fixtures.ts`; authenticate with `.loginAs(user)`.
Every protected endpoint needs a test proving another store's member gets
403/404.
