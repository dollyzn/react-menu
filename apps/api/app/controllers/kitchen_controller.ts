import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { messageOnly, ok } from '#helpers/api_response'
import KitchenService from '#services/kitchen_service'
import OrderService from '#services/order_service'
import { storeExistValidator } from '#validators/common'
import { prepareUnitsValidator } from '#validators/order'

@inject()
export default class KitchenController {
  constructor(
    private kitchen: KitchenService,
    private orders: OrderService
  ) {}

  async queue({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return ok(await this.kitchen.queue(storeId))
  }

  async prepare({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const { units } = await request.validateUsing(prepareUnitsValidator)

    await this.orders.prepareUnits(storeId, units, auth.getUserOrFail())

    return messageOnly('Produção atualizada')
  }
}
