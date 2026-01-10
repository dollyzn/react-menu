import { healthChecks } from '#start/health'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'

export default class HealthChecksController {
  async handle({ request, response }: HttpContext) {
    const startedAt = Date.now()
    const report = await healthChecks.run()
    const durationMs = Date.now() - startedAt

    const payload = {
      app: 'Menu API',
      environment: env.get('NODE_ENV'),
      timestamp: new Date().toISOString(),
      duration_ms: durationMs,
      request_id: request.header('x-request-id'),
      host: request.host(),
      report,
    }

    response.header('Cache-Control', 'no-store')
    response.header('X-Health-Status', report.status)

    if (report.isHealthy) {
      return response.ok(payload)
    }
    return response.serviceUnavailable(payload)
  }
}
