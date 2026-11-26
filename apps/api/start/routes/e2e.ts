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

  // WhatsApp (ADR 0025, fake client): the last login code sent to a phone,
  // and a customer's message reaching the store's number.
  router
    .get('/__e2e/whatsapp/login-code', async ({ request, response }) => {
      const { default: FakeWhatsAppClient } = await import('#whatsapp/fake_client')
      const phone = String(request.input('phone', '')).replace(/\D/g, '')
      const sent = [...FakeWhatsAppClient.sent]
        .reverse()
        .find((message) => message.to === phone && message.body.type === 'template')
      const template = sent?.body.template as
        { components?: { parameters?: { text?: string }[] }[] } | undefined
      const code = template?.components?.[0]?.parameters?.[0]?.text
      return code ? { code } : response.notFound({ error: 'No code sent to this phone' })
    })
    .as('e2e.whatsappLoginCode')
  router
    .post('/__e2e/whatsapp/inbound', async ({ request, response }) => {
      const { default: Store } = await import('#models/store')
      const { default: WhatsAppAccount } = await import('#models/whatsapp_account')
      const { default: CustomerLoginService } = await import('#services/customer_login_service')
      const store = await Store.findByOrFail('slug', String(request.input('slug', '')))
      const account = await WhatsAppAccount.findBy('storeId', store.id)
      if (!account) return response.notFound({ error: 'The store has no WhatsApp' })
      const login = await app.container.make(CustomerLoginService)
      const matched = await login.receiveMessage(
        account,
        String(request.input('from', '')),
        String(request.input('text', ''))
      )
      return { matched }
    })
    .as('e2e.whatsappInbound')
}
