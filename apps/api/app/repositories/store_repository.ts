import Store from '#models/store'
import type { ModelAdapterOptions, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import { whereEqOrInColumn, whereLikeAnyColumn } from '#helpers/list_filter_query'
import type {
  StoreFindOptions,
  StoreListOptions,
  StorePreloadKey,
  StorePreloadOption,
} from '#types/store_query'

function resolveStorePreloadKeys(preload: StorePreloadOption | undefined): StorePreloadKey[] {
  if (preload === false) return []
  if (preload === true || preload === undefined) return ['categories', 'addons']
  return preload
}

function applyStorePreloads(
  query: ModelQueryBuilderContract<typeof Store>,
  keys: StorePreloadKey[]
) {
  for (const key of keys) {
    query.preload(key)
  }
}

export default class StoreRepository {
  query(options?: ModelAdapterOptions): ModelQueryBuilderContract<typeof Store> {
    return Store.query(options)
  }

  private baseListQuery(options?: StoreListOptions) {
    const { filters, preload } = options ?? {}
    const { name, status } = filters ?? {}
    const keys = resolveStorePreloadKeys(preload)
    const query = this.query()
    applyStorePreloads(query, keys)

    whereLikeAnyColumn(query, 'name', name)
    whereEqOrInColumn(query, 'status', status)

    return query.orderBy('created_at', 'desc')
  }

  async paginate(options?: StoreListOptions) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 10
    return await this.baseListQuery(options).paginate(page, perPage)
  }

  async findById(id: string, options?: StoreFindOptions) {
    const keys = resolveStorePreloadKeys(options?.preload)
    const query = this.query().where('id', id)
    applyStorePreloads(query, keys)
    const store = await query.first()
    if (!store) throw new AppException('Loja não encontrada', 404)
    return store
  }

  async requireById(id: string, trx?: TransactionClientContract) {
    const query = this.query({ client: trx }).where('id', id)
    const store = await query.first()
    if (!store) throw new AppException('Loja não encontrada', 404)
    return store
  }

  async create(data: Partial<Store>, trx?: TransactionClientContract) {
    return await Store.create(data, trx ? { client: trx } : undefined)
  }

  async update(id: string, data: Partial<Store>, trx?: TransactionClientContract) {
    const store = await this.requireById(id, trx)
    store.merge(data)
    await store.save()
    return store
  }

  async delete(id: string, trx?: TransactionClientContract) {
    const store = await this.requireById(id, trx)
    await store.delete()
  }

  async all(options?: StoreFindOptions) {
    const keys = resolveStorePreloadKeys(options?.preload)
    const query = this.query()
    applyStorePreloads(query, keys)
    return await query
  }

  async findForPublicMenu(slug: string | undefined) {
    const query = this.query().preload('categories', (categoryQuery) => {
      categoryQuery
        .orderBy('order', 'asc')
        .preload('items', (itemQuery) => itemQuery.orderBy('order', 'asc').preload('addons'))
    })

    if (slug) {
      query.where('slug', slug)
    } else {
      query.where('is_default', true)
    }

    const store = await query.first()
    if (!store) throw new AppException('Loja não encontrada', 404)
    return store
  }

  async findForPublicMenuByStoreId(storeId: string) {
    const query = this.query().preload('categories', (categoryQuery) => {
      categoryQuery
        .orderBy('order', 'asc')
        .preload('items', (itemQuery) => itemQuery.orderBy('order', 'asc').preload('addons'))
    })

    query.where('id', storeId)

    const store = await query.first()
    if (!store) throw new AppException('Loja não encontrada', 404)
    return store
  }
}
