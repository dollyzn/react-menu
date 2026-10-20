import Ingredient from '#models/ingredient'
import type { ModelAdapterOptions, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import { whereLikeAnyColumn } from '#helpers/list_filter_query'

export default class IngredientRepository {
  query(options?: ModelAdapterOptions): ModelQueryBuilderContract<typeof Ingredient> {
    return Ingredient.query(options)
  }

  async listInStore(storeId: string, filters: { name?: string | string[] } = {}) {
    const query = this.query().where('store_id', storeId)
    whereLikeAnyColumn(query, 'name', filters.name)
    return await query.orderBy('name', 'asc')
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
