import Category from '#models/category'
import type { ModelAdapterOptions, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import { whereEqOrInColumn, whereLikeAnyColumn } from '#helpers/list_filter_query'
import type {
  CategoryFindOptions,
  CategoryListOptions,
  CategoryPreloadKey,
  CategoryPreloadOption,
} from '#types/category_query'

function resolveCategoryPreloadKeys(
  preload: CategoryPreloadOption | undefined
): CategoryPreloadKey[] {
  if (preload === false) return []
  if (preload === true || preload === undefined) return ['items']
  return preload
}

function applyCategoryPreloads(
  query: ModelQueryBuilderContract<typeof Category>,
  keys: CategoryPreloadKey[]
) {
  for (const key of keys) {
    query.preload(key)
  }
}

export default class CategoryRepository {
  query(options?: ModelAdapterOptions): ModelQueryBuilderContract<typeof Category> {
    return Category.query(options)
  }

  private baseListQuery(options?: CategoryListOptions) {
    const { filters, preload } = options ?? {}
    const { storeId, name } = filters ?? {}
    const keys = resolveCategoryPreloadKeys(preload)
    const query = this.query()
    applyCategoryPreloads(query, keys)

    whereEqOrInColumn(query, 'store_id', storeId)
    whereLikeAnyColumn(query, 'name', name)

    query.withCount('items', (iq) => {
      iq.as('itemsCount')
    })

    return query.orderBy('order', 'asc')
  }

  async paginate(options?: CategoryListOptions) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 10
    return await this.baseListQuery(options).paginate(page, perPage)
  }

  async findById(id: number, options?: CategoryFindOptions) {
    const keys = resolveCategoryPreloadKeys(options?.preload)
    const query = this.query().where('id', id)
    applyCategoryPreloads(query, keys)
    const category = await query.first()
    if (!category) throw new AppException('Categoria não encontrada', 404)
    return category
  }

  async findByIdInStore(
    id: number,
    storeId: string,
    options?: CategoryFindOptions,
    trx?: TransactionClientContract
  ) {
    const keys = resolveCategoryPreloadKeys(options?.preload)
    const query = this.query(trx ? { client: trx } : undefined).where('id', id).where('store_id', storeId)
    applyCategoryPreloads(query, keys)
    const category = await query.first()
    if (!category) throw new AppException('Categoria não encontrada', 404)
    return category
  }

  async requireById(id: number, trx?: TransactionClientContract) {
    const query = this.query({ client: trx }).where('id', id)
    const category = await query.first()
    if (!category) throw new AppException('Categoria não encontrada', 404)
    return category
  }

  async findByStore(storeId: string, options?: CategoryFindOptions) {
    const keys = resolveCategoryPreloadKeys(options?.preload ?? false)
    const query = this.query().where('store_id', storeId)
    applyCategoryPreloads(query, keys)
    query.withCount('items', (q) => {
      q.as('itemsCount')
    })
    return await query.orderBy('order', 'asc')
  }

  async create(data: Partial<Category>, trx?: TransactionClientContract) {
    return await Category.create(data, trx ? { client: trx } : undefined)
  }

  async update(id: number, data: Partial<Category>, trx?: TransactionClientContract) {
    const category = await this.requireById(id, trx)
    category.merge(data)
    await category.save()
    return category
  }

  async delete(id: number, trx?: TransactionClientContract) {
    const category = await this.requireById(id, trx)
    await category.delete()
  }

  async all(options?: CategoryFindOptions) {
    const query = this.query().orderBy('order', 'asc')
    if (options?.preload !== undefined) {
      applyCategoryPreloads(query, resolveCategoryPreloadKeys(options.preload))
    }
    return await query
  }

  async getMaxOrderByStore(storeId: string) {
    const result = await this.query().where('store_id', storeId).max('order as maxOrder').first()

    return result ? Number(result.$extras.maxOrder) : 0
  }
}
