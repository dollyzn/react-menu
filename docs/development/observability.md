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
by id (`user.id`, set by the auth middleware) and stores by `store.id`. Order
tracking tokens (`/pedido/<token>`, `/orders/<token>`) and secrets in query
strings (`token`, `code`, `state`, …) are masked in recorded URLs, on both
sides. Client errors (4xx) are not counted as span errors; 5xx are, with the
stack.

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

With the local Grafana up, `pnpm dev` sends too: the endpoint must be in the
process environment (a value only in `.env` is read too late, after the
loader hook should be in place):

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm dev
```

The API (`node ace serve`, HMR included), the worker (`queue:work`) and the
web all send then; without the variable nothing does. `otel.ts` is imported
first by `bin/server.ts` and, for `queue:work`, `bin/console.ts`; production
also preloads it (`node --import ./otel.js`), and it runs once either way.
(It used to break `node ace serve`: a `@poppinss/ts-exec` regression,
fixed in 1.5.2; see [adonisjs/otel#27](https://github.com/adonisjs/otel/issues/27).)

Or run the whole production stack (`docker compose up -d --build`) with
`OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318`. On Linux
that host name needs `extra_hosts: ["host.docker.internal:host-gateway"]` on
the `api`, `worker` and `web` services (Docker Desktop has it built in).

## Where it lives

- API: `apps/api/otel.ts` (imported first by `bin/server.ts` and, for
  `queue:work`, `bin/console.ts`; preloaded with `--import` in production;
  starts the SDK only with an endpoint), `app/helpers/otel.ts` (`otelRunning()`, `redactUrl`),
  `providers/otel_provider.ts` and `start/kernel.ts` (provider and middleware
  only when it runs), `config/otel.ts` (service names, sampling, ignored
  URLs, URL masking, the queue instrumentation), `AuthMiddleware` /
  `StoreAccessMiddleware` (`user.id`, `store.id`), `app/exceptions/handler.ts`
  (4xx not marked as errors).
- Web: `apps/web/instrumentation.ts` (propagation, URL masking).
- Docker: `Dockerfile` (`--import ./otel.js`), `docker-compose.yml`
  (production env, worker command), `docker-compose.dev.yml` (profile
  `observability`).
