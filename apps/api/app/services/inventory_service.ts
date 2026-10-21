import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import StockMovementType from '#enums/stock_movement_type'
import Addon from '#models/addon'
import Ingredient from '#models/ingredient'
import Item from '#models/item'
import type Order from '#models/order'
import StockMovement from '#models/stock_movement'
import Store from '#models/store'
import IngredientRepository, {
  type IngredientListOptions,
} from '#repositories/ingredient_repository'
import { suggestIngredientIcon } from '#kitchen/ingredient_icons'

type RecipeLine = { ingredientId: number; quantity: number }

/** Rounds to the 3 decimals stored in the database. */
const round3 = (value: number) => Math.round(value * 1000) / 1000

@inject()
export default class InventoryService {
  constructor(private repo: IngredientRepository) {}

  async list(storeId: string, options: IngredientListOptions = {}) {
    return await this.repo.paginateInStore(storeId, options)
  }

  async create(
    storeId: string,
    data: {
      name: string
      unit: Ingredient['unit']
      icon?: string | null
      minStock?: number
      stockQuantity?: number
    },
    userId: string
  ) {
    return await db.transaction(async (trx) => {
      const exists = await this.repo
        .query({ client: trx })
        .where({ storeId })
        .whereILike('name', data.name)
        .first()
      if (exists) throw new AppException('Já existe um ingrediente com esse nome', 422)

      const ingredient = await Ingredient.create(
        {
          storeId,
          name: data.name,
          unit: data.unit,
          icon: data.icon ?? suggestIngredientIcon(data.name),
          minStock: data.minStock ?? 0,
        },
        { client: trx }
      )
      if (data.stockQuantity) {
        await this.move(ingredient, StockMovementType.ADJUSTMENT, data.stockQuantity, trx, {
          userId,
          note: 'Estoque inicial',
        })
      }
      return ingredient
    })
  }

  async update(
    storeId: string,
    id: number,
    data: Partial<Pick<Ingredient, 'name' | 'unit' | 'minStock' | 'icon'>>
  ) {
    const ingredient = await this.repo.findInStore(storeId, id)
    ingredient.merge(data)
    // Cleared icon: back to the suggestion for the (possibly new) name.
    if (data.icon === null) ingredient.icon = suggestIngredientIcon(ingredient.name)
    await ingredient.save()
    return ingredient
  }

  async remove(storeId: string, id: number) {
    const ingredient = await this.repo.findInStore(storeId, id)
    await ingredient.delete()
  }

  async movements(storeId: string, id: number) {
    await this.repo.findInStore(storeId, id)
    return await StockMovement.query()
      .where('ingredientId', id)
      .orderBy('createdAt', 'desc')
      .limit(50)
  }

  /** Manual stock entry: purchase, waste or a physical count (adjustment). */
  async recordMovement(
    storeId: string,
    id: number,
    input: { type: StockMovementType; quantity: number; note?: string },
    userId: string
  ) {
    return await db.transaction(async (trx) => {
      const ingredient = await this.repo.findInStore(storeId, id, trx)
      await ingredient.useTransaction(trx).refresh()

      const delta =
        input.type === StockMovementType.PURCHASE
          ? input.quantity
          : input.type === StockMovementType.WASTE
            ? -input.quantity
            : input.quantity - ingredient.stockQuantity

      await this.move(ingredient, input.type, delta, trx, { userId, note: input.note })
      await ingredient.refresh()
      return ingredient
    })
  }

  async setItemRecipe(storeId: string, item: Item, lines: RecipeLine[]) {
    await db.transaction(async (trx) => {
      await item
        .useTransaction(trx)
        .related('ingredients')
        .sync(await this.pivot(storeId, lines, trx))
    })
  }

  async setAddonRecipe(storeId: string, addon: Addon, lines: RecipeLine[]) {
    await db.transaction(async (trx) => {
      await addon
        .useTransaction(trx)
        .related('ingredients')
        .sync(await this.pivot(storeId, lines, trx))
    })
  }

  /**
   * Items and add-ons that cannot be sold now: switched off by hand, or (when
   * the store tracks stock) missing an ingredient for one unit.
   */
  async unavailable(store: Store, trx?: TransactionClientContract) {
    const client = trx ?? db
    const items = new Set<string>()
    const addons = new Set<string>()

    if (store.inventoryEnabled) {
      const itemRows = await client
        .from('item_ingredients as r')
        .join('ingredients as i', 'i.id', 'r.ingredient_id')
        .where('i.store_id', store.id)
        .whereRaw('i.stock_quantity < r.quantity')
        .distinct('r.item_id')
      const addonRows = await client
        .from('addon_ingredients as r')
        .join('ingredients as i', 'i.id', 'r.ingredient_id')
        .where('i.store_id', store.id)
        .whereRaw('i.stock_quantity < r.quantity')
        .distinct('r.addon_id')
      for (const row of itemRows) items.add(row.item_id)
      for (const row of addonRows) addons.add(row.addon_id)
    }

    return { items, addons }
  }

  /**
   * Ingredient needs of an order: item recipes × quantity plus add-on
   * recipes × the quantity of the line they belong to.
   */
  async requirementsFor(order: Order, trx: TransactionClientContract) {
    const lines = await order.related('items').query().useTransaction(trx).preload('addons')
    const needs = new Map<number, number>()
    const add = (ingredientId: number, quantity: number) =>
      needs.set(ingredientId, round3((needs.get(ingredientId) ?? 0) + quantity))

    const itemIds = [...new Set(lines.flatMap((line) => (line.itemId ? [line.itemId] : [])))]
    const addonIds = [
      ...new Set(
        lines.flatMap((line) =>
          line.addons.flatMap((addon) => (addon.addonId ? [addon.addonId] : []))
        )
      ),
    ]

    const itemRecipes = itemIds.length
      ? await db.from('item_ingredients').useTransaction(trx).whereIn('item_id', itemIds)
      : []
    const addonRecipes = addonIds.length
      ? await db.from('addon_ingredients').useTransaction(trx).whereIn('addon_id', addonIds)
      : []

    for (const line of lines) {
      for (const row of itemRecipes.filter((r) => r.item_id === line.itemId)) {
        add(row.ingredient_id, Number(row.quantity) * line.quantity)
      }
      for (const addon of line.addons) {
        for (const row of addonRecipes.filter((r) => r.addon_id === addon.addonId)) {
          add(row.ingredient_id, Number(row.quantity) * line.quantity)
        }
      }
    }
    return needs
  }

  /** Deducts an order's ingredients once (idempotent via stock_consumed_at). */
  async consumeForOrder(order: Order, trx: TransactionClientContract) {
    if (order.stockConsumedAt) return
    const store = await Store.findOrFail(order.storeId, { client: trx })
    if (!store.inventoryEnabled) return

    for (const [ingredientId, quantity] of await this.requirementsFor(order, trx)) {
      const ingredient = await Ingredient.findOrFail(ingredientId, { client: trx })
      await this.move(ingredient, StockMovementType.CONSUMPTION, -quantity, trx, {
        orderId: order.id,
      })
    }
    order.stockConsumedAt = DateTime.now()
  }

  /** Puts back what an order consumed (used when it is cancelled). */
  async reverseForOrder(order: Order, trx: TransactionClientContract) {
    if (!order.stockConsumedAt) return

    const consumed = await StockMovement.query({ client: trx }).where({
      orderId: order.id,
      type: StockMovementType.CONSUMPTION,
    })
    for (const movement of consumed) {
      const ingredient = await Ingredient.findOrFail(movement.ingredientId, { client: trx })
      await this.move(ingredient, StockMovementType.REVERSAL, -movement.quantity, trx, {
        orderId: order.id,
      })
    }
    order.stockConsumedAt = null
  }

  private async move(
    ingredient: Ingredient,
    type: StockMovementType,
    delta: number,
    trx: TransactionClientContract,
    meta: { userId?: string; orderId?: string; note?: string } = {}
  ) {
    const quantity = round3(delta)
    if (quantity === 0) return

    // Atomic in SQL so concurrent orders never overwrite each other.
    await Ingredient.query({ client: trx })
      .where('id', ingredient.id)
      .increment('stock_quantity', quantity)
    await StockMovement.create(
      {
        storeId: ingredient.storeId,
        ingredientId: ingredient.id,
        type,
        quantity,
        orderId: meta.orderId ?? null,
        userId: meta.userId ?? null,
        note: meta.note ?? null,
      },
      { client: trx }
    )
  }

  private async pivot(storeId: string, lines: RecipeLine[], trx: TransactionClientContract) {
    const ids = [...new Set(lines.map((line) => line.ingredientId))]
    const valid = new Set(await this.repo.idsInStore(storeId, ids, trx))
    if (valid.size !== ids.length) {
      throw new AppException('Ingrediente não encontrado nesta loja', 422)
    }
    return Object.fromEntries(
      lines.map((line) => [line.ingredientId, { quantity: round3(line.quantity) }])
    )
  }
}
