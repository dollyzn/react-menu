import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Store from '#models/store'
import WhatsAppAccountService from '#services/whatsapp_account_service'

/**
 * Connects a store to a number without Embedded Signup (ADR 0025): a test
 * number of the app's own WABA, or a number the platform's business already
 * manages, with a token in hand (a system user's, with the WhatsApp
 * permissions on that WABA). Same steps as the panel: the webhook override,
 * our templates submitted, the review polled.
 *
 *   node ace whatsapp:connect --store=<slug> --waba=<WABA_ID> --phone=<PHONE_NUMBER_ID>
 *     [--skip-register]  (already on the Cloud API: Meta's test numbers)
 *
 * The token is asked (hidden), never taken as a flag (shell history).
 */
export default class WhatsAppConnect extends BaseCommand {
  static commandName = 'whatsapp:connect'
  static description = 'Connect a store to a WhatsApp number with a token (test numbers)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Store slug', required: true })
  declare store: string

  @flags.string({ description: 'WhatsApp Business Account id', required: true })
  declare waba: string

  @flags.string({ description: 'Phone number id', required: true })
  declare phone: string

  @flags.boolean({ description: 'The number is already registered (test numbers)', default: false })
  declare skipRegister: boolean

  async run() {
    const store = await Store.findBy('slug', this.store)
    if (!store) {
      this.logger.error(`Loja "${this.store}" não encontrada`)
      this.exitCode = 1
      return
    }
    const token = await this.prompt.secure('Token de acesso (system user ou da empresa)')
    const accounts = await this.app.container.make(WhatsAppAccountService)
    try {
      const account = await accounts.connect(store, {
        token: token.trim(),
        wabaId: this.waba,
        phoneNumberId: this.phone,
        skipRegister: this.skipRegister,
      })
      this.logger.success(`${store.name} conectada ao número ${account.displayPhoneNumber}`)
      for (const [name, state] of Object.entries(account.templates)) {
        this.logger.info(`${name}: ${state.status}${state.reason ? ` (${state.reason})` : ''}`)
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error))
      this.exitCode = 1
    }
  }
}
