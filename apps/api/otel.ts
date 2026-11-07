/**
 * OpenTelemetry initialization. Its loader hook must be in place before
 * anything it instruments is imported, so it runs first: preloaded by the
 * production commands (`node --import ./otel.js bin/server.js`, and
 * `… ace queue:work` for the worker) and imported first by bin/server.ts and,
 * for `queue:work`, bin/console.ts, which also covers `pnpm dev`
 * (`node ace serve`). One module: preloaded and imported, it runs once.
 *
 * It starts only with OTEL_EXPORTER_OTLP_ENDPOINT in the process environment
 * (a value only in .env is read too late). Settings live in config/otel.ts.
 */
import { init } from '@adonisjs/otel/init'

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // Read by #helpers/otel: the provider, middleware and queue hooks load only then.
  ;(globalThis as { __reactMenuOtel?: boolean }).__reactMenuOtel = true
  await init(import.meta.dirname)
}
