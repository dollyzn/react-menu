import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { e2eCodes } from '#services/two_factor_service'

/**
 * e2e only (E2E_TEST_HOOKS): the e2e run has no mail worker, so it reads the
 * last sign-in code sent to an e-mail here. Never registered otherwise, and
 * the app refuses to boot with it in production.
 */
export default function e2eRoutes() {
  if (!env.get('E2E_TEST_HOOKS')) return
  if (app.inProduction) throw new Error('E2E_TEST_HOOKS must never be enabled in production')
  router
    .get('/__e2e/two-factor-code', ({ request, response }) => {
      const code = e2eCodes.get(String(request.input('email', '')).toLowerCase())
      return code ? { code } : response.notFound({ error: 'No code sent to this e-mail' })
    })
    .as('e2e.twoFactorCode')
}
