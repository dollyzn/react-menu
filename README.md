# React Menu

Open-source digital menus for restaurants: an admin app to manage stores,
categories, items and add-ons, and a public menu for customers.

- **API**: AdonisJS 6, PostgreSQL, Redis, VineJS, Bouncer, Transmit (SSE)
- **Web**: Next.js 16, React 19, RTK Query, shadcn/ui on Base UI, Tailwind 4
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/contracts`)

> Status: menu management is functional; ordering is not built yet. See
> [docs/development/roadmap.md](docs/development/roadmap.md).

## Requirements

- Node.js 24 (`nvm use`) and pnpm via corepack (`corepack enable`)
- PostgreSQL 14+ with the `uuid-ossp` extension available
- Redis 6+

## Getting started

```bash
pnpm install

# API
cp apps/api/.env.example apps/api/.env
#   fill DB_*, REDIS_*, ADMIN_USER/ADMIN_PASS (the first super user)
pnpm --filter @react-menu/api exec node ace generate:key
createdb jjpasteis-menu          # or the name you set in DB_DATABASE
pnpm --filter @react-menu/api exec node ace migration:run
pnpm --filter @react-menu/api exec node ace db:seed

# Web
cp apps/web/.env.example apps/web/.env

pnpm dev    # API on :3333, web on :3000
```

Sign in at <http://localhost:3000/app/login> with `ADMIN_USER`/`ADMIN_PASS`.
Store images use the local disk by default (`DRIVE_DISK=fs`); web push is
optional (see the VAPID notes in the `.env.example` files).

## Commands

| | |
| --- | --- |
| `pnpm dev` / `dev:api` / `dev:web` | Run apps in development |
| `pnpm lint` / `pnpm typecheck` | Static checks for every package |
| `pnpm test` | API functional tests (needs database `jjpasteis-menu-test`) |
| `pnpm test:e2e` | Playwright end-to-end tests (needs database `jjpasteis-menu-e2e`; first run `pnpm --filter @react-menu/web exec playwright install chromium`) |
| `pnpm check` | lint + typecheck + API tests |
| `pnpm build` | Production builds |

Create the test databases once: `createdb jjpasteis-menu-test` and
`createdb jjpasteis-menu-e2e`.

## Documentation

- [AGENTS.md](AGENTS.md): conventions and how to add a feature (for humans and AI agents)
- [docs/architecture](docs/architecture/README.md): how the system works
- [docs/decisions](docs/decisions/README.md): architecture decision records
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
