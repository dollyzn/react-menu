# React Menu

Open-source digital menu and ordering system for restaurants, built for a
pastry shop's real day: customers order from their phone and pick up at the
counter, attendants take orders at a mobile POS, and the cook works from a
kitchen display that batches identical pastries and shows the ingredients.

- **Customer menu**: search, item details with add-ons and notes, bag,
  checkout with name + phone (no account), pay at the counter or online
  (Mercado Pago), live order tracking
- **Operations**: orders board, POS, kitchen display (KDS), store roles
  (manager, attendant, kitchen), realtime updates and notifications
- **Management**: categories/items/add-ons with drag-and-drop ordering,
  inventory with recipes and automatic stock consumption, store settings

- **API**: AdonisJS 6, PostgreSQL, Redis, VineJS, Bouncer, Transmit (SSE)
- **Web**: Next.js 16, React 19, RTK Query, shadcn/ui on Base UI, Tailwind 4
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/contracts`)

> Status: actively developed; see
> [docs/development/roadmap.md](docs/development/roadmap.md) for known gaps.

## Requirements

- Node.js 24 (`nvm use`) and pnpm via corepack (`corepack enable`)
- PostgreSQL 14+ with the `uuid-ossp` extension available
- Redis 6+

## Getting started

### With Docker (quickest)

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis (dev, test and e2e databases)
```

Then follow the steps below; the `apps/api/.env.example` defaults already
point at these containers. To run the apps in containers too (hot reload):
`docker compose -f docker-compose.dev.yml --profile app up`.

### On your machine

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

The development seed creates a demo store (JJ Pastéis, the default menu at
<http://localhost:3000>) with stock, recipes and staff accounts:

| Role | Login | Password |
| --- | --- | --- |
| Manager (super user) | `ADMIN_USER` from `apps/api/.env` | `ADMIN_PASS` |
| Attendant (POS, orders) | `atendente@jjpasteis.dev` | `demo12345` |
| Kitchen (KDS) | `cozinha@jjpasteis.dev` | `demo12345` |

Staff sign in at <http://localhost:3000/app/login>.
Store images use the local disk by default (`DRIVE_DISK=fs`); web push is
optional and uses Firebase Cloud Messaging (free); see the `FIREBASE_*`
notes in both `.env.example` files.

## Production with Docker

```bash
cp .env.docker.example .env      # fill APP_KEY, passwords, PUBLIC_URL, SITE_ADDRESS
docker compose up -d --build
docker compose exec api node ace db:seed   # first run: roles and the admin user
```

Caddy serves the web app and the API on one origin (required by the session
cookie) and gets HTTPS certificates when `SITE_ADDRESS` is a domain.
Migrations run when the API container starts. CI builds both images and
smoke-tests this stack on every push.

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
