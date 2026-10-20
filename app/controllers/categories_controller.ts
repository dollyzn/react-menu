import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CategoryService from '#services/category_service'
import {
  bulkDeleteValidator,
  storeValidator,
  updateOrderValidator,
  updateValidator,
} from '#validators/category'
import { numberValidator, storeExistValidator } from '#validators/common'
import { bulkDeleted, created, messageOnly, ok, updated } from '#helpers/api_response'
import { parsePagination, pickQueryFilters } from '#helpers/query_string_parser'

@inject()
export default class CategoriesController {
  constructor(private categoryService: CategoryService) {}

  async index({ request, params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const q = request.qs()

    const categories = await this.categoryService.list({
      ...parsePagination(q),
      preload: false,
      filters: {
        storeId,
        ...pickQueryFilters(q, ['name']),
      },
    })

    return ok(categories.all(), categories.getMeta())
  }

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await numberValidator.validate(params.categoryId)

    const category = await this.categoryService.getInStore(storeId, id)

    return ok(category)
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const data = await request.validateUsing(storeValidator)

    const category = await this.categoryService.create({ storeId, ...data })

    return created(category, 'Categoria criada com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await numberValidator.validate(params.categoryId)

    const data = await request.validateUsing(updateValidator)

    const category = await this.categoryService.updateInStore(storeId, id, data)

    return updated(category, 'Categoria atualizada com sucesso')
  }

  async updateOrder({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const { id, order } = await request.validateUsing(updateOrderValidator)

    const category = await this.categoryService.updateOrderInStore(storeId, id, order)

    return updated(category, 'Ordem atualizada com sucesso')
  }

  async destroy({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await numberValidator.validate(params.categoryId)

    await this.categoryService.removeInStore(storeId, id)

    return messageOnly('Categoria excluída com sucesso')
  }

  async bulkDelete({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const { ids } = await request.validateUsing(bulkDeleteValidator)

    const result = await this.categoryService.bulkDeleteForStore(storeId, ids)

    return bulkDeleted(result, {
      success: 'Categorias excluídas com sucesso',
      partial: 'Algumas categorias não puderam ser excluídas',
    })
  }
}
