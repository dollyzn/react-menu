import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import InventoryService from '#services/inventory_service'
import { numberValidator, storeExistValidator } from '#validators/common'
import {
  ingredientValidator,
  stockMovementValidator,
  updateIngredientValidator,
} from '#validators/inventory'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import { pickQueryFilters } from '#helpers/query_string_parser'

@inject()
export default class IngredientsController {
  constructor(private inventory: InventoryService) {}

  async index({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const ingredients = await this.inventory.list(storeId, pickQueryFilters(request.qs(), ['name']))

    return ok(ingredients)
  }

  async store({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const data = await request.validateUsing(ingredientValidator)

    const ingredient = await this.inventory.create(storeId, data, auth.getUserOrFail().id)

    return created(ingredient, 'Ingrediente criado com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await numberValidator.validate(params.ingredientId)
    const data = await request.validateUsing(updateIngredientValidator)

    const ingredient = await this.inventory.update(storeId, id, data)

    return updated(ingredient, 'Ingrediente atualizado com sucesso')
  }

  async destroy({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await numberValidator.validate(params.ingredientId)

    await this.inventory.remove(storeId, id)

    return messageOnly('Ingrediente excluído com sucesso')
  }

  async movements({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await numberValidator.validate(params.ingredientId)

    return ok(await this.inventory.movements(storeId, id))
  }

  async recordMovement({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await numberValidator.validate(params.ingredientId)
    const input = await request.validateUsing(stockMovementValidator)

    const ingredient = await this.inventory.recordMovement(
      storeId,
      id,
      input,
      auth.getUserOrFail().id
    )

    return updated(ingredient, 'Estoque atualizado')
  }
}
