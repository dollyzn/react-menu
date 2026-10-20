import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ItemService from '#services/item_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import {
  bulkDeleteValidator,
  categoryExistValidator,
  storeValidator,
  updateOrderValidator,
  updateValidator,
} from '#validators/item'
import { bulkDeleted, created, messageOnly, ok, updated } from '#helpers/api_response'
import { parsePagination, pickQueryFilters } from '#helpers/query_string_parser'

@inject()
export default class ItemsController {
  constructor(private itemService: ItemService) {}

  async index({ request, params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const q = request.qs()

    const items = await this.itemService.listInStore(storeId, {
      ...parsePagination(q),
      filters: {
        ...pickQueryFilters(q, ['name', 'category_name']),
      },
    })

    return ok(items.all(), items.getMeta())
  }

  async indexByCategory({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const categoryId = await categoryExistValidator.validate(params.categoryId)

    const items = await this.itemService.getByCategoryInStore(storeId, categoryId)

    return ok(items)
  }

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const itemId = await uuidValidator.validate(params.itemId)

    const item = await this.itemService.getInStore(storeId, itemId)

    return ok(item)
  }

  async store({ request, params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const categoryId = await categoryExistValidator.validate(params.categoryId)

    const { addonIds, ...data } = await request.validateUsing(storeValidator)

    const item = await this.itemService.create(storeId, {
      categoryId,
      addonIds,
      ...data,
    })

    return created(item, 'Item criado com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const itemId = await uuidValidator.validate(params.itemId)

    const { addonIds, ...data } = await request.validateUsing(updateValidator)

    const item = await this.itemService.update(storeId, itemId, {
      addonIds,
      ...data,
    })

    return updated(item, 'Item atualizado com sucesso')
  }

  async updateOrder({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const { id, order } = await request.validateUsing(updateOrderValidator)

    await this.itemService.updateOrderInStore(storeId, id, order)

    return messageOnly('Ordem atualizada com sucesso')
  }

  async bulkDelete({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const { ids } = await request.validateUsing(bulkDeleteValidator)

    const result = await this.itemService.bulkDeleteForStore(storeId, ids)

    return bulkDeleted(result, {
      success: 'Itens excluídos com sucesso',
      partial: 'Alguns itens não puderam ser excluídos',
    })
  }

  async destroy({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const itemId = await uuidValidator.validate(params.itemId)

    await this.itemService.removeInStore(storeId, itemId)

    return messageOnly('Item excluído com sucesso')
  }
}
