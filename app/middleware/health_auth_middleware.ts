import AppException from '#exceptions/app_exception'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default async function healthAuth({ request }: HttpContext, next: NextFn) {
  const header = request.header('x-monitoring-secret')

  if (!header || header !== env.get('HEALTH_CHECK_MONITORING_TOKEN')) {
    throw new AppException('Unauthorized', 401)
  }

  const allowlistRaw = env.get('HEALTH_CHECK_MONITORING_ALLOWLIST')

  if (allowlistRaw) {
    const allowlist = allowlistRaw
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean)
    const ip = request.ip()
    if (allowlist.length && !allowlist.includes(ip)) {
      throw new AppException('Forbidden', 403)
    }
  }

  return next()
}
