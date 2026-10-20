import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AppException from '#exceptions/app_exception'
import Addon from '#models/addon'
import InventoryService from '#services/inventory_service'
import ItemRepository from '#repositories/item_repository'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { recipeValidator } from '#validators/inventory'
import { ok, updated } from '#helpers/api_response'

/** Recipes: the ingredients one unit of an item or add-on consumes. */
@inject()
export default class RecipesController {
  constructor(
    private inventory: InventoryService,
    private items: ItemRepository
  ) {}

  async showItem({ params }: HttpContext) {
    const item = await this.findItem(params)
    await item.load('ingredients')
    return ok(item.ingredients)
  }

  async updateItem({ params, request }: HttpContext) {
    const item = await this.findItem(params)
    const { ingredients } = await request.validateUsing(recipeValidator)

    await this.inventory.setItemRecipe(item.category.storeId, item, ingredients)
    await item.load('ingredients')

    return updated(item.ingredients, 'Receita atualizada')
  }

  async showAddon({ params }: HttpContext) {
    const addon = await this.findAddon(params)
    await addon.load('ingredients')
    return ok(addon.ingredients)
  }

  async updateAddon({ params, request }: HttpContext) {
    const addon = await this.findAddon(params)
    const { ingredients } = await request.validateUsing(recipeValidator)

    await this.inventory.setAddonRecipe(addon.storeId, addon, ingredients)
    await addon.load('ingredients')

    return updated(addon.ingredients, 'Receita atualizada')
  }

  private async findItem(params: Record<string, string>) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const itemId = await uuidValidator.validate(params.itemId)
    const item = await this.items.findByIdInStore(itemId, storeId, { preload: false })
    await item.load('category')
    return item
  }

  private async findAddon(params: Record<string, string>) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const addonId = await uuidValidator.validate(params.addonId)
    const addon = await Addon.query().where({ id: addonId, storeId }).first()
    if (!addon) throw new AppException('Adicional não encontrado', 404)
    return addon
  }
}
