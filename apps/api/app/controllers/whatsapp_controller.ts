import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { randomUUID } from 'node:crypto'
import AppException from '#exceptions/app_exception'
import { messageOnly, ok, updated } from '#helpers/api_response'
import Store from '#models/store'
import WhatsAppAccountService from '#services/whatsapp_account_service'
import WhatsAppMessageService from '#services/whatsapp_message_service'
import { storeExistValidator } from '#validators/common'
import {
  whatsappConnectValidator,
  whatsappFakeConnectValidator,
  whatsappSettingsValidator,
} from '#validators/whatsapp'
import { whatsappConfig } from '#whatsapp/config'

/** The store's WhatsApp number (managers; ADR 0025). */
@inject()
export default class WhatsAppController {
  constructor(
    private accounts: WhatsAppAccountService,
    private messageLog: WhatsAppMessageService
  ) {}

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return ok(this.accounts.present(await this.accounts.forStore(storeId)))
  }

  /**
   * Embedded Signup finished in the browser: `code` + the WABA and number it
   * chose. With the development fake, `{ fake: true }` connects a test number.
   */
  async connect({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const store = await Store.findOrFail(storeId)
    this.accounts.assertEnabled()

    const input = whatsappConfig().fake
      ? await this.fakeInput(request.all())
      : await request.validateUsing(whatsappConnectValidator)
    const account = await this.accounts.connect(store, input, auth.user)
    return updated(this.accounts.present(account), 'WhatsApp conectado.')
  }

  /** Reads the number and the templates again and re-applies the webhook override. */
  async refresh({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const account = await this.connected(storeId)
    await this.accounts.refresh(account)
    return ok(this.accounts.present(account))
  }

  async updateSettings({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const input = await request.validateUsing(whatsappSettingsValidator)
    const account = await this.connected(storeId)
    await this.accounts.updateSettings(account, input)
    return ok(this.accounts.present(account))
  }

  /** Repeating it once disconnected is harmless (ADR 0013). */
  async disconnect({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const account = await this.accounts.forStore(storeId)
    if (account) await this.accounts.disconnect(account)
    return messageOnly('WhatsApp desconectado.')
  }

  /** The last messages sent through the number, for the panel. */
  async messages({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const { messages, today } = await this.messageLog.recent(storeId)
    return ok(messages, { today })
  }

  private async connected(storeId: string) {
    const account = await this.accounts.forStore(storeId)
    if (!account) {
      throw new AppException(
        'Esta loja não tem WhatsApp conectado.',
        404,
        'E_WHATSAPP_NOT_CONNECTED'
      )
    }
    return account
  }

  /** Development fake: a test number per store, no Meta involved. */
  private async fakeInput(body: unknown) {
    await whatsappFakeConnectValidator.validate(body)
    const suffix = randomUUID().replace(/\D/g, '').slice(0, 12).padEnd(12, '0')
    return { code: 'fake', wabaId: `9${suffix}`, phoneNumberId: `8${suffix}` }
  }
}
