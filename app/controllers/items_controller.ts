import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ItemService from '#services/item_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import {
  categoryExistValidator,
  storeValidator,
  updateOrderValidator,
  updateValidator,
} from '#validators/item'
import { created, messageOnly, ok, updated } from '#helpers/api_response'

@inject()
export default class ItemsController {
  constructor(private itemService: ItemService) {}

  async indexByCategory({ params }: HttpContext) {
    const categoryId = await categoryExistValidator.validate(params.id)

    const items = await this.itemService.getByCategory(categoryId)

    return ok(items)
  }

  async indexByStore({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    const items = await this.itemService.getByStore(storeId)

    return ok(items)
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const item = await this.itemService.get(id)

    return ok(item)
  }

  async store({ request, params }: HttpContext) {
    const categoryId = await categoryExistValidator.validate(params.categoryId)

    const { addonIds, ...data } = await request.validateUsing(storeValidator)

    const item = await this.itemService.create({
      categoryId,
      addonIds,
      ...data,
    })

    return created(item, 'Item criado com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const { addonIds, ...data } = await request.validateUsing(updateValidator)

    const item = await this.itemService.update(id, {
      addonIds,
      ...data,
    })

    return updated(item, 'Item atualizado com sucesso')
  }

  async updateOrder({ request }: HttpContext) {
    const { id, order } = await request.validateUsing(updateOrderValidator)

    await this.itemService.updateOrder(id, order)

    return messageOnly('Ordem atualizada com sucesso')
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    await this.itemService.remove(id)

    return messageOnly('Item excluído com sucesso')
  }
}
