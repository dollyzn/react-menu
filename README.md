# React Menu

Open-source digital menu and ordering system for restaurants, built for a
pastry shop's real day: customers order from their phone and pick up at the
counter, attendants take orders at a mobile POS, and the cook works from a
kitchen display that batches identical pastries and shows the ingredients.

- **Customer menu**: search, item details with add-ons and notes, bag,
  checkout with name + phone (no account), pay at the counter or online
  with Pix or card without leaving the app (Mercado Pago), live order tracking
- **Operations**: orders board, POS, kitchen display (KDS), store roles
  (manager, attendant, kitchen), realtime updates and notifications
- **Management**: categories/items/add-ons with drag-and-drop ordering,
  inventory with recipes and automatic stock consumption, store settings

- **API**: AdonisJS 7, PostgreSQL, Redis, VineJS, Bouncer, Transmit (SSE)
- **Web**: Next.js 16, React 19, RTK Query, shadcn/ui on Base UI, Tailwind 4
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/contracts`)

> Status: actively developed; see
> [docs/development/roadmap.md](docs/development/roadmap.md) for known gaps.

## Requirements

- **Local (try it out / develop):** Node.js 24 (`nvm use`), pnpm via corepack
  (`corepack enable`) and Docker for the databases, or your own
  PostgreSQL 14+ (with the `uuid-ossp` extension available) and Redis 6+.
- **Production:** a server with Docker and Docker Compose.

## Getting started (local)

### 1. Install

```bash
git clone https://github.com/dollyzn/react-menu.git
cd react-menu
pnpm install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter @react-menu/api exec node ace generate:key   # writes APP_KEY
```

The `.env` defaults work as they are with the Docker databases below. In
`apps/api/.env`, `ADMIN_USER` / `ADMIN_PASS` are the login of the first super
user.

### 2. Start the databases

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts Postgres (with the `jjpasteis-menu`, `-test` and `-e2e`
databases) and Redis. Ports already taken? Set `DEV_POSTGRES_PORT` /
`DEV_REDIS_PORT` (defaults 5432 / 6379) and the same ports in
`apps/api/.env`.

Without Docker: create the three databases yourself (`createdb
jjpasteis-menu`, `createdb jjpasteis-menu-test`, `createdb
jjpasteis-menu-e2e`) and point `DB_*` and `REDIS_*` in `apps/api/.env` at
your servers.

### 3. Create the tables and the demo data

```bash
pnpm --filter @react-menu/api exec node ace migration:run
pnpm --filter @react-menu/api exec node ace db:seed
```

### 4. Run

```bash
pnpm dev    # API on http://localhost:3333, web on http://localhost:3000
```

- Customer menu: <http://localhost:3000>
- Staff panel: <http://localhost:3000/app/login>

The seed creates a demo store (JJ Pastéis) with menu photos, stock, recipes
and staff accounts:

| Role | Login | Password |
| --- | --- | --- |
| Manager (super user) | `ADMIN_USER` from `apps/api/.env` | `ADMIN_PASS` |
| Attendant (POS, orders) | `atendente@jjpasteis.dev` | `demo12345` |
| Kitchen (KDS) | `cozinha@jjpasteis.dev` | `demo12345` |

Online payments work locally without Mercado Pago credentials:
`PAYMENTS_FAKE_GATEWAY=true` (the `.env.example` default, ignored in
production) offers a test Pix on the order page with a "Simular pagamento
aprovado" button. Real Pix and card need the store's credentials in
**Loja › Pagamentos online**.

Images are stored on the local disk (`DRIVE_DISK=fs`). Web push is optional
(Firebase Cloud Messaging, free): see the `FIREBASE_*` notes in both
`.env.example` files.

**Everything in containers instead** (no Node on your machine): after
step 1, `docker compose -f docker-compose.dev.yml --profile app up` runs the
databases, the API and the web app with hot reload, and applies migrations
and the seed by itself. `DEV_API_PORT` / `DEV_WEB_PORT` change the ports.

### Updating your local copy

```bash
git pull
pnpm install
pnpm --filter @react-menu/api exec node ace migration:run
```

If something fails to start after an update, compare your `.env` files with
the `.env.example` ones: new variables are added there. To start over with
fresh demo data (this **erases** the development database):
`pnpm --filter @react-menu/api exec node ace migration:fresh --seed`.

## Production (Docker)

One server with Docker runs everything: Caddy (HTTPS and a single origin for
the web app and the API, required by the session cookie), the web app, the
API, PostgreSQL and Redis.

### First install

```bash
git clone https://github.com/dollyzn/react-menu.git
cd react-menu
cp .env.docker.example .env
```

Fill `.env`: `SITE_ADDRESS` and `PUBLIC_URL` (your domain; Caddy gets the
HTTPS certificate automatically), `APP_KEY` (`openssl rand -base64 32`), the
admin login and the passwords. Then:

```bash
docker compose up -d --build
docker compose exec api node ace db:seed   # roles and the admin user (no demo data)
```

Sign in at `PUBLIC_URL/app/login` with `ADMIN_USER` / `ADMIN_PASS` and
create your store. `HTTP_PORT` / `HTTPS_PORT` change the published ports
(defaults 80 / 443).

**Keep `APP_KEY`**: it encrypts the stored payment credentials; losing or
changing it makes them unreadable.

### Updating

```bash
cd react-menu
docker compose exec -T postgres pg_dump -U menu menu > backup-$(date +%F).sql   # backup first
git pull
docker compose up -d --build
```

In the backup, `menu menu` are the default `POSTGRES_USER` and `POSTGRES_DB`;
use yours if you changed them. The rebuilt API applies new migrations when
it starts. Data, uploaded images and certificates live in Docker volumes and
survive updates. Check `docker compose logs -f api` if something looks
wrong, and compare `.env` with `.env.docker.example` for new variables.

Running `db:seed` again is only needed when a release says so; it also
resets the admin password to `ADMIN_PASS`.

## Commands

| | |
| --- | --- |
| `pnpm dev` / `dev:api` / `dev:web` | Run apps in development |
| `pnpm lint` / `pnpm typecheck` | Static checks for every package |
| `pnpm test` | API functional tests (needs database `jjpasteis-menu-test`) |
| `pnpm test:e2e` | Playwright end-to-end tests (needs database `jjpasteis-menu-e2e`; first run `pnpm --filter @react-menu/web exec playwright install chromium`) |
| `pnpm check` | lint + typecheck + API tests |
| `pnpm build` | Production builds |

The test databases come with the Docker setup; without it, create them as
in step 2.

## Documentation

- [AGENTS.md](AGENTS.md): conventions and how to add a feature (for humans and AI agents)
- [docs/architecture](docs/architecture/README.md): how the system works
- [docs/decisions](docs/decisions/README.md): architecture decision records
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
