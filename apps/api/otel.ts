/**
 * OpenTelemetry initialization, preloaded by the production commands only:
 * `node --import ./otel.js bin/server.js` (Dockerfile) and
 * `node --import ./otel.js ace queue:work` (the compose worker). Its loader
 * hook must be in place before anything it instruments is imported, and
 * under `node ace serve` (TypeScript) it breaks the app's boot
 * (https://github.com/adonisjs/otel/issues/27), so development and tests
 * never load this file. Settings live in config/otel.ts.
 *
 * It starts only with OTEL_EXPORTER_OTLP_ENDPOINT in the environment.
 */
import { init } from '@adonisjs/otel/init'

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // Read by #helpers/otel: the provider, middleware and queue hooks load only then.
  ;(globalThis as { __reactMenuOtel?: boolean }).__reactMenuOtel = true
  await init(import.meta.dirname)
}
