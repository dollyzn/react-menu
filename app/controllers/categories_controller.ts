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
import { created, fail, messageOnly, ok, updated } from '#helpers/api_response'

@inject()
export default class CategoriesController {
  constructor(private categoryService: CategoryService) {}

  async index({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const categories = await this.categoryService.getByStore(storeId)

    return ok(categories)
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

    const { deletedCategories, failedDeletions } = await this.categoryService.bulkDeleteForStore(
      storeId,
      ids
    )

    if (failedDeletions.length > 0) {
      return fail('Algumas categorias não puderam ser excluídas', {
        deletedCategories,
        failedDeletions,
      })
    }

    return {
      ...ok(deletedCategories),
      message: 'Categorias excluídas com sucesso',
    }
  }
}
