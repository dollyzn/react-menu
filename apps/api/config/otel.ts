import { defineConfig } from '@adonisjs/otel'
import { QueueManager } from '@adonisjs/queue'
import { QueueInstrumentation } from '@adonisjs/queue/otel'
import env from '#start/env'

/**
 * OpenTelemetry: traces, logs and metrics over OTLP/HTTP to the endpoint in
 * OTEL_EXPORTER_OTLP_ENDPOINT (Grafana Cloud; see
 * docs/development/observability.md). It runs only in the compiled build with
 * the endpoint in the process environment (see otel.ts): never under
 * `node ace serve`, never in tests.
 *
 * Covered: HTTP in and out (Mercado Pago, Resend, FCM…), Lucid queries,
 * Redis, and queue jobs: a span when a job is dispatched and another when the
 * worker runs it (linked), with the job's queries and calls inside.
 */
const queue = new QueueInstrumentation({ executionSpanLinkMode: 'link' })
queue.manuallyRegister({ QueueManager })

/** The worker (`node ace queue:work`) and the HTTP server show as separate services. */
const isWorker = process.argv.includes('queue:work')

export default defineConfig({
  serviceName: env.get('OTEL_SERVICE_NAME', isWorker ? 'react-menu-worker' : 'react-menu-api'),
  serviceVersion: env.get('APP_VERSION', 'dev'),
  environment: env.get('APP_ENV', env.get('NODE_ENV')),
  enabled: Boolean(env.get('OTEL_EXPORTER_OTLP_ENDPOINT')),
  samplingRatio: env.get('OTEL_TRACES_SAMPLE_RATIO', 1),

  instrumentations: {
    '@opentelemetry/instrumentation-http': {
      // Long-lived realtime streams and uploaded files say nothing useful.
      ignoredUrls: ['/__transmit/*', '/uploads/*', '/api/v1/__e2e/*'],
    },
    '@adonisjs/queue': queue,
  },

  /**
   * Who made the request, without personal data (no e-mail): the user id and
   * the store it acted on, to filter traces by store in Grafana.
   */
  userContext: {
    resolver: (ctx) => {
      const user = ctx.auth?.user
      if (!user) return null
      const storeId = ctx.params.storeId as string | undefined
      return { id: user.id, ...(storeId ? { 'store.id': storeId } : {}) }
    },
  },
})
