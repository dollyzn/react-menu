# Observability (OpenTelemetry → Grafana)

The API, the queue worker and the web server send **traces, logs and
metrics** over OTLP/HTTP. In production they go to **Grafana Cloud** (free
tier); in development to a local, open-source Grafana stack.

Nothing is sent unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## What you get

| Service | Name in Grafana | Instrumented |
| --- | --- | --- |
| API (`@adonisjs/otel`) | `react-menu-api` | every request (route, status, user id and `store.id`), Lucid queries (SQL), Redis, outgoing HTTP (Mercado Pago, Resend, Firebase), errors with their stack, Pino logs with `trace_id`/`span_id` |
| Worker (`@adonisjs/queue/otel`) | `react-menu-worker` | one span per job run (linked to the span that dispatched it), with the job's queries and calls inside |
| Web (`@vercel/otel`) | `react-menu-web` | server rendering, route handlers, server actions, fetches |

A page rendered on the server and the API calls behind it share one trace:
the web sends `traceparent` to the API (`instrumentation.ts`, only to the API's
origin). E-mails, cookies and request bodies are not recorded; users appear
by id.

## Grafana Cloud (production)

1. Create a free account at grafana.com and a stack (pick the region closest
   to the server).
2. In the stack, open **Connections → OpenTelemetry (OTLP)** (or "Send data →
   OpenTelemetry") and create an access token. It shows the endpoint, e.g.
   `https://otlp-gateway-prod-sa-east-1.grafana.net/otlp`, and the instance id.
3. In the server's `.env` (from `.env.docker.example`):

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-<region>.grafana.net/otlp
   # "Basic " + base64("<instance id>:<token>"); the space is written %20
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64>
   OTEL_TRACES_SAMPLE_RATIO=1      # lower it (e.g. 0.2) if traffic outgrows the free tier
   APP_ENV=production
   ```

   `echo -n '<instance id>:<token>' | base64 -w0` gives the base64 part.
4. `docker compose up -d`. In Grafana: **Explore → Tempo** (traces), **Loki**
   (logs, filter by `service_name`), **Prometheus/Mimir** (metrics), or the
   **Application Observability** app, which builds service pages from them.

The free tier has monthly limits (traces, logs and metric series) and a short
retention; check the current numbers on grafana.com. `OTEL_TRACES_SAMPLE_RATIO`
is the knob if traces grow too much.

## Locally (open-source Grafana)

```bash
docker compose -f docker-compose.dev.yml --profile observability up -d lgtm
```

`grafana/otel-lgtm` runs an OpenTelemetry collector (OTLP on `:4318`/`:4317`)
with Tempo, Loki and Prometheus behind it, and Grafana at
<http://localhost:3005> (admin / admin).

**The API only sends from the compiled build.** Under `node ace serve`
(TypeScript), the OpenTelemetry loader hook breaks the app's boot ("Cannot
resolve binding server"), so `otel.ts` skips it there: `pnpm dev` never sends.
To try it with the local Grafana:

```bash
cd apps/api && node ace build
cd build && set -a && . ../.env && set +a
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node bin/server.js     # API
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 node ace queue:work    # worker
```

(The variable must be in the process environment: a value only in `.env` is
read too late.) The web app sends from `pnpm dev` too:
`OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm dev:web`.

Or run the whole production stack (`docker compose up -d --build`) with
`OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318`.

## Where it lives

- API: `apps/api/otel.ts` (starts it first; compiled build + endpoint only),
  `config/otel.ts` (service names, sampling, ignored URLs, user context, the
  queue instrumentation), `bin/server.ts` and `bin/console.ts` (worker) import
  it first, `start/kernel.ts` (middleware after auth), `config/logger.ts`
  (trace ids in logs).
- Web: `apps/web/instrumentation.ts`.
- Compose: `docker-compose.yml` (production env), `docker-compose.dev.yml`
  (profile `observability`).
