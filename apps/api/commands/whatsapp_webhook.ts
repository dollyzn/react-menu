import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Store from '#models/store'
import WhatsAppAccount from '#models/whatsapp_account'
import WhatsAppAccountService from '#services/whatsapp_account_service'
import { whatsappConfig } from '#whatsapp/config'

/**
 * Applies our webhook override again to the connected WABAs (ADR 0025):
 * after the API's domain (APP_URL / WHATSAPP_WEBHOOK_URL) or the verify
 * token changed. The app's default callback is never touched.
 *
 *   node ace whatsapp:webhook [--store=<slug>]
 */
export default class WhatsAppWebhook extends BaseCommand {
  static commandName = 'whatsapp:webhook'
  static description = 'Point the connected WhatsApp numbers to this API (webhook override)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Only this store (slug)' })
  declare store?: string

  async run() {
    const query = WhatsAppAccount.query().preload('store')
    if (this.store) {
      const store = await Store.findBy('slug', this.store)
      if (!store) {
        this.logger.error(`Loja "${this.store}" não encontrada`)
        this.exitCode = 1
        return
      }
      query.where('storeId', store.id)
    }
    const accounts = await query
    const service = await this.app.container.make(WhatsAppAccountService)
    this.logger.info(`Webhook: ${whatsappConfig().webhookUrl}`)
    for (const account of accounts) {
      try {
        await service.resubscribe(account)
        this.logger.success(`${account.store.name} (${account.displayPhoneNumber})`)
      } catch (error) {
        this.logger.error(
          `${account.store.name}: ${error instanceof Error ? error.message : String(error)}`
        )
        this.exitCode = 1
      }
    }
    if (accounts.length === 0) this.logger.info('Nenhuma loja com WhatsApp conectado.')
  }
}
