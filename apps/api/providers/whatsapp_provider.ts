import type { ApplicationService } from '@adonisjs/core/types'

/**
 * WhatsApp Cloud (ADR 0025): with WHATSAPP_FAKE in development or e2e, the
 * Graph client resolves to the fake one (no calls to Meta). Tests swap it
 * themselves with `app.container.swap`.
 */
export default class WhatsAppProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    const { whatsappFake } = await import('#whatsapp/config')
    if (!whatsappFake()) return
    const { default: WhatsAppClient } = await import('#whatsapp/client')
    const { default: FakeWhatsAppClient } = await import('#whatsapp/fake_client')
    const fake = new FakeWhatsAppClient()
    this.app.container.bind(WhatsAppClient, () => fake)
  }
}
