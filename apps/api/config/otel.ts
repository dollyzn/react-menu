import type { IncomingMessage } from 'node:http'
import { defineConfig } from '@adonisjs/otel'
import { QueueManager } from '@adonisjs/queue'
import { QueueInstrumentation } from '@adonisjs/queue/otel'
import env from '#start/env'
import { otelRunning, redactUrl } from '#helpers/otel'

/**
 * OpenTelemetry: traces, logs and metrics over OTLP/HTTP to the endpoint in
 * OTEL_EXPORTER_OTLP_ENDPOINT (Grafana Cloud; see
 * docs/development/observability.md). It runs only when otel.ts was
 * preloaded (production commands with an endpoint); otherwise this file is
 * read like any config and does nothing.
 *
 * Covered: HTTP in and out (Mercado Pago, Resend, FCM…), Lucid queries,
 * Redis, and queue jobs: a span when a job is dispatched and another when the
 * worker runs it (linked), with the job's queries and calls inside. The user
 * and the store are set by the auth and storeAccess middleware (#helpers/otel).
 */
const queue = new QueueInstrumentation({ executionSpanLinkMode: 'link' })
// Patches QueueManager: only in a process that actually sends telemetry.
if (otelRunning()) queue.manuallyRegister({ QueueManager })

export default defineConfig({
  // The compose worker sets OTEL_SERVICE_NAME=react-menu-worker.
  serviceName: env.get('OTEL_SERVICE_NAME', 'react-menu-api'),
  serviceVersion: env.get('APP_VERSION', 'dev'),
  environment: env.get('APP_ENV', env.get('NODE_ENV')),
  enabled: otelRunning(),
  samplingRatio: env.get('OTEL_TRACES_SAMPLE_RATIO', 1),

  instrumentations: {
    '@opentelemetry/instrumentation-http': {
      // Long-lived realtime streams and uploaded files say nothing useful.
      ignoredUrls: ['/__transmit/*', '/uploads/*', '/api/v1/__e2e/*'],
      // Order tracking tokens and OAuth codes never reach the traces.
      requestHook: (span, request) => {
        // Incoming requests only (the outgoing ones have no tokens of ours).
        if (!('headers' in request) || 'setHeader' in request) return
        const incoming = request as IncomingMessage
        const url = incoming.url ?? ''
        const safe = redactUrl(url)
        if (safe === url) return
        const [path, query] = safe.split('?')
        const full = `http://${incoming.headers.host ?? 'localhost'}${safe}`
        span.setAttributes({
          'http.target': safe,
          'http.url': full,
          'url.full': full,
          'url.path': path,
        })
        if (query) span.setAttribute('url.query', query)
      },
    },
    ...(otelRunning() ? { '@adonisjs/queue': queue } : {}),
  },

  // The library's resolver runs before authentication (no user yet): the
  // auth middleware sets it instead.
  userContext: false,
})
