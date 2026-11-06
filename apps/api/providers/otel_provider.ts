import type { ApplicationService } from '@adonisjs/core/types'
import { otelRunning } from '#helpers/otel'

/**
 * Loads @adonisjs/otel's provider (exceptions on spans, its middleware,
 * flushing on shutdown) only in a process that sends telemetry. Elsewhere
 * (development, tests, Ace commands) its OpenTelemetry imports cost ~0.6 s
 * at every boot for nothing.
 */
export default class OtelProvider {
  #provider?: { register(): void; shutdown(): Promise<void> }

  constructor(protected app: ApplicationService) {}

  async boot() {
    if (!otelRunning()) return
    const { default: Provider } = await import('@adonisjs/otel/otel_provider')
    this.#provider = new Provider(this.app)
    this.#provider.register()
  }

  async shutdown() {
    await this.#provider?.shutdown()
  }
}
