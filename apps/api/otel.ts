/**
 * OpenTelemetry initialization. Imported FIRST by bin/server.ts and, for the
 * queue worker only, by bin/console.ts: its loader hook must be in place
 * before anything it instruments (http, knex, ioredis) is imported.
 * Settings live in config/otel.ts.
 *
 * It starts only when both hold:
 * - OTEL_EXPORTER_OTLP_ENDPOINT is in the process environment (Docker,
 *   compose, the shell; a value only in .env isn't read this early);
 * - this is the compiled build (`node bin/server.js`, the Docker images).
 *   Under `node ace serve` (TypeScript), the hook breaks the app's boot
 *   ("Cannot resolve binding server"), so development runs without it
 *   (https://github.com/adonisjs/otel/issues/27).
 */
import { init } from '@adonisjs/otel/init'

const compiled = !import.meta.url.endsWith('.ts')
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && compiled) {
  await init(import.meta.dirname)
}
