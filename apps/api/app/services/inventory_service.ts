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

/** An order line as far as stock is concerned. */
export type StockLine = { itemId: string | null; addonIds: string[]; quantity: number }

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
   * How many units of each item and add-on the stock still makes (the
   * scarcest ingredient of its recipe decides). Only for stores that track
   * stock, and only for things with a recipe; the rest are unlimited.
   */
  async capacities(store: Store, trx?: TransactionClientContract) {
    const client = trx ?? db
    const items = new Map<string, number>()
    const addons = new Map<string, number>()
    if (!store.inventoryEnabled) return { items, addons }

    const capacity = (
      table: 'item_ingredients' | 'addon_ingredients',
      key: 'item_id' | 'addon_id'
    ) =>
      client
        .from(`${table} as r`)
        .join('ingredients as i', 'i.id', 'r.ingredient_id')
        .where('i.store_id', store.id)
        .where('r.quantity', '>', 0)
        .groupBy(`r.${key}`)
        .select(`r.${key} as id`)
        .select(db.raw('greatest(min(floor(i.stock_quantity / r.quantity)), 0)::int as units'))
    for (const row of await capacity('item_ingredients', 'item_id')) items.set(row.id, row.units)
    for (const row of await capacity('addon_ingredients', 'addon_id')) addons.set(row.id, row.units)
    return { items, addons }
  }

  /**
   * Items and add-ons that cannot be sold now: switched off by hand, or (when
   * the store tracks stock) missing an ingredient for one unit.
   */
  async unavailable(store: Store, trx?: TransactionClientContract) {
    const { items, addons } = await this.capacities(store, trx)
    const empty = (units: Map<string, number>) =>
      new Set([...units].filter(([, count]) => count < 1).map(([id]) => id))
    return { items: empty(items), addons: empty(addons) }
  }

  /**
   * Ingredient needs of order lines: item recipes × quantity plus add-on
   * recipes × the quantity of the line they belong to.
   */
  async needsOf(lines: StockLine[], trx?: TransactionClientContract) {
    const client = trx ?? db
    const needs = new Map<number, { quantity: number; itemIds: Set<string> }>()
    const itemIds = [...new Set(lines.map((line) => line.itemId).filter(Boolean))] as string[]
    const addonIds = [...new Set(lines.flatMap((line) => line.addonIds))]

    const itemRecipes = itemIds.length
      ? await client.from('item_ingredients').whereIn('item_id', itemIds)
      : []
    const addonRecipes = addonIds.length
      ? await client.from('addon_ingredients').whereIn('addon_id', addonIds)
      : []

    const add = (ingredientId: number, quantity: number, itemId: string | null) => {
      const need = needs.get(ingredientId) ?? { quantity: 0, itemIds: new Set<string>() }
      need.quantity = round3(need.quantity + quantity)
      if (itemId) need.itemIds.add(itemId)
      needs.set(ingredientId, need)
    }
    for (const line of lines) {
      for (const row of itemRecipes.filter((r) => r.item_id === line.itemId)) {
        add(row.ingredient_id, Number(row.quantity) * line.quantity, line.itemId)
      }
      for (const addonId of line.addonIds) {
        for (const row of addonRecipes.filter((r) => r.addon_id === addonId)) {
          add(row.ingredient_id, Number(row.quantity) * line.quantity, line.itemId)
        }
      }
    }
    return needs
  }

  /** Needs of an existing order (for consuming its stock). */
  async requirementsFor(order: Order, trx: TransactionClientContract) {
    const lines = await order.related('items').query().useTransaction(trx).preload('addons')
    return await this.needsOf(
      lines.map((line) => ({
        itemId: line.itemId,
        addonIds: line.addons.flatMap((addon) => (addon.addonId ? [addon.addonId] : [])),
        quantity: line.quantity,
      })),
      trx
    )
  }

  /**
   * Refuses an order the stock can't make (e.g. 10 egg pastries with one
   * egg). The ingredients are locked until the caller's transaction ends,
   * so two orders can't both take the last unit.
   */
  async assertStock(
    store: Store,
    lines: (StockLine & { name: string })[],
    trx: TransactionClientContract
  ) {
    if (!store.inventoryEnabled) return
    const needs = await this.needsOf(lines, trx)
    if (needs.size === 0) return

    const ingredients = await Ingredient.query({ client: trx })
      .whereIn('id', [...needs.keys()])
      .where('storeId', store.id)
      .orderBy('id')
      .forUpdate()
    for (const ingredient of ingredients) {
      const need = needs.get(ingredient.id)!
      if (ingredient.stockQuantity + 1e-9 >= need.quantity) continue

      const involved = lines.filter((line) => line.itemId && need.itemIds.has(line.itemId))
      const names = [...new Set(involved.map((line) => line.name))]
      let message = `Não temos ${ingredient.name.toLowerCase()} suficiente para este pedido. Diminua a quantidade de ${names.join(', ')}.`
      if (involved.length === 1) {
        const perUnit = need.quantity / involved[0].quantity
        const max = Math.max(0, Math.floor((ingredient.stockQuantity + 1e-9) / perUnit))
        message =
          max === 0
            ? `${names[0]} acabou agora.`
            : `Só dá para fazer ${max} ${names[0]} agora (acabando ${ingredient.name.toLowerCase()}).`
      }
      throw new AppException(message, 422, 'E_OUT_OF_STOCK', {
        ingredient: ingredient.name,
        itemIds: [...need.itemIds],
      })
    }
  }

  /** Deducts an order's ingredients once (idempotent via stock_consumed_at). */
  async consumeForOrder(order: Order, trx: TransactionClientContract) {
    if (order.stockConsumedAt) return
    const store = await Store.findOrFail(order.storeId, { client: trx })
    if (!store.inventoryEnabled) return

    for (const [ingredientId, { quantity }] of await this.requirementsFor(order, trx)) {
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
