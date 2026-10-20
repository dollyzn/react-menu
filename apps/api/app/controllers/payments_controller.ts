import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import Store from '#models/store'
import { messageOnly, ok } from '#helpers/api_response'
import PaymentService from '#services/payment_service'
import { storeExistValidator } from '#validators/common'
import { paymentSettingsValidator } from '#validators/payment'

@inject()
export default class PaymentsController {
  constructor(private payments: PaymentService) {}

  /** Mercado Pago notifications (public; authenticated by signature). */
  async mercadoPagoWebhook({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const store = await Store.findOrFail(storeId)

    await this.payments.handleWebhook(store, {
      type: request.input('type') ?? request.input('topic'),
      dataId: String(request.input('data.id') ?? request.qs()['data.id'] ?? ''),
      signature: request.header('x-signature'),
      requestId: request.header('x-request-id'),
    })

    return messageOnly('ok')
  }

  /** Managers set or clear the store's Mercado Pago credentials. */
  async updateSettings({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const data = await request.validateUsing(paymentSettingsValidator)
    const store = await Store.findOrFail(storeId)

    store.merge(data)
    await store.save()

    return ok({ mercadoPagoEnabled: store.mercadoPagoEnabled })
  }
}
