import db from '@adonisjs/lucid/services/db'
import type { ProductionBatch } from '@react-menu/contracts'
import OrderStatus from '#enums/order_status'
import type IngredientUnit from '#enums/ingredient_unit'
import { buildProductionQueue, type PendingUnit } from '#kitchen/production_queue'
import { suggestIngredientIcon } from '#kitchen/ingredient_icons'
import Order from '#models/order'
import Store from '#models/store'

type RecipeRow = {
  owner_id: string
  name: string
  unit: IngredientUnit
  icon: string | null
  quantity: string
}

const round3 = (value: number) => Math.round(value * 1000) / 1000

export default class KitchenService {
  /** What to make next, grouped into batches with their total ingredients. */
  async queue(storeId: string): Promise<ProductionBatch[]> {
    const store = await Store.findOrFail(storeId)
    const orders = await Order.query()
      .where({ storeId })
      .whereIn('status', [OrderStatus.RECEIVED, OrderStatus.PREPARING])
      .preload('items', (items) =>
        items.where('requiresPreparation', true).preload('addons').orderBy('id')
      )
      .orderBy('createdAt', 'asc')

    const pending: (PendingUnit & { addonIds: string[] })[] = orders.flatMap((order, orderIndex) =>
      order.items.map((line) => ({
        orderId: order.id,
        orderNumber: order.number,
        orderIndex,
        lineId: line.id,
        itemId: line.itemId,
        name: line.name,
        addons: line.addons.map((addon) => addon.name),
        addonIds: line.addons.flatMap((addon) => (addon.addonId ? [addon.addonId] : [])),
        notes: line.notes,
        remaining: line.quantity - line.preparedQuantity,
      }))
    )

    const batches = buildProductionQueue(pending, store.kitchenBatchLookahead)
    const recipes = await this.recipes(pending)

    return batches.map((batch) => {
      const first = pending.find((unit) => unit.lineId === batch.units[0].lineId)!
      const rows = [
        ...(first.itemId ? (recipes.items.get(first.itemId) ?? []) : []),
        ...first.addonIds.flatMap((id) => recipes.addons.get(id) ?? []),
      ]

      const totals = new Map<
        string,
        { name: string; unit: IngredientUnit; icon: string | null; quantity: number }
      >()
      for (const row of rows) {
        const current = totals.get(row.name) ?? {
          name: row.name,
          unit: row.unit,
          icon: row.icon ?? suggestIngredientIcon(row.name),
          quantity: 0,
        }
        current.quantity = round3(current.quantity + Number(row.quantity) * batch.quantity)
        totals.set(row.name, current)
      }

      return { ...batch, ingredients: [...totals.values()] }
    })
  }

  private async recipes(pending: { itemId: string | null; addonIds: string[] }[]) {
    const itemIds = [...new Set(pending.flatMap((unit) => (unit.itemId ? [unit.itemId] : [])))]
    const addonIds = [...new Set(pending.flatMap((unit) => unit.addonIds))]

    const itemRows: RecipeRow[] = itemIds.length
      ? await db
          .from('item_ingredients as r')
          .join('ingredients as i', 'i.id', 'r.ingredient_id')
          .whereIn('r.item_id', itemIds)
          .select('r.item_id as owner_id', 'i.name', 'i.unit', 'i.icon', 'r.quantity')
      : []
    const addonRows: RecipeRow[] = addonIds.length
      ? await db
          .from('addon_ingredients as r')
          .join('ingredients as i', 'i.id', 'r.ingredient_id')
          .whereIn('r.addon_id', addonIds)
          .select('r.addon_id as owner_id', 'i.name', 'i.unit', 'i.icon', 'r.quantity')
      : []

    const group = (rows: RecipeRow[]) => {
      const map = new Map<string, RecipeRow[]>()
      for (const row of rows) map.set(row.owner_id, [...(map.get(row.owner_id) ?? []), row])
      return map
    }
    return { items: group(itemRows), addons: group(addonRows) }
  }
}
