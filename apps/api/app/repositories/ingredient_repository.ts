import Ingredient from '#models/ingredient'
import db from '@adonisjs/lucid/services/db'
import type { ModelAdapterOptions, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import { whereEqOrInColumn, whereLikeAnyColumn } from '#helpers/list_filter_query'
import type { SortSpec } from '#helpers/query_string_parser'

export type IngredientListOptions = {
  page?: number
  perPage?: number
  sort?: SortSpec
  filters?: {
    name?: string | string[]
    unit?: string | string[]
    /** `low`: at or below the minimum; `ok`: above it. Both = no filter. */
    stock?: string | string[]
  }
}

export default class IngredientRepository {
  query(options?: ModelAdapterOptions): ModelQueryBuilderContract<typeof Ingredient> {
    return Ingredient.query(options)
  }

  async paginateInStore(storeId: string, options: IngredientListOptions = {}) {
    const query = this.filtered(storeId, options.filters)
    for (const { column, direction } of options.sort ?? []) query.orderBy(column, direction)
    return await query.orderBy('name', 'asc').paginate(options.page ?? 1, options.perPage ?? 10)
  }

  /**
   * How many ingredients each filter option would show: the name search and
   * the other filter apply, the filter's own choice doesn't.
   */
  async facetsInStore(storeId: string, filters: IngredientListOptions['filters'] = {}) {
    // One after the other: inside a transaction they share one connection.
    const units = await this.filtered(storeId, filters, 'unit')
      .select('unit')
      .count('* as total')
      .groupBy('unit')
      .pojo<{ unit: string; total: string | number }>()
    const [stock] = await this.filtered(storeId, filters, 'stock')
      .select(
        db.raw('count(*) filter (where stock_quantity <= min_stock) as low'),
        db.raw('count(*) filter (where stock_quantity > min_stock) as ok')
      )
      .pojo<{ low: string | number; ok: string | number }>()
    return {
      unit: Object.fromEntries(units.map((row) => [row.unit, Number(row.total)])),
      stock: { low: Number(stock?.low ?? 0), ok: Number(stock?.ok ?? 0) },
    }
  }

  /** The list's filters on a query; `except` leaves one out (for its counts). */
  private filtered(
    storeId: string,
    filters: IngredientListOptions['filters'] = {},
    except?: 'unit' | 'stock'
  ) {
    const query = this.query().where('store_id', storeId)
    whereLikeAnyColumn(query, 'name', filters.name)
    if (except !== 'unit') whereEqOrInColumn(query, 'unit', filters.unit)
    const stock = new Set([filters.stock ?? []].flat())
    if (except !== 'stock' && stock.has('low') !== stock.has('ok')) {
      query.whereRaw(`stock_quantity ${stock.has('low') ? '<=' : '>'} min_stock`)
    }
    return query
  }

  async findInStore(storeId: string, id: number, trx?: TransactionClientContract) {
    const ingredient = await this.query({ client: trx }).where({ id, storeId }).first()
    if (!ingredient) throw new AppException('Ingrediente não encontrado', 404)
    return ingredient
  }

  /** Ids of `ids` that belong to the store. */
  async idsInStore(storeId: string, ids: number[], trx?: TransactionClientContract) {
    if (ids.length === 0) return []
    const rows = await this.query({ client: trx })
      .where('store_id', storeId)
      .whereIn('id', ids)
      .select('id')
    return rows.map((row) => row.id)
  }
}
