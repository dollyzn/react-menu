import Item from '#models/item'
import type { ModelAdapterOptions, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import { whereLikeAnyColumn } from '#helpers/list_filter_query'
import type {
  ItemFindOptions,
  ItemListOptions,
  ItemPreloadKey,
  ItemPreloadOption,
} from '#types/item_query'

function resolveItemPreloadKeys(preload: ItemPreloadOption | undefined): ItemPreloadKey[] {
  if (preload === false) return []
  if (preload === true || preload === undefined) return ['addons', 'category']
  return preload
}

function applyItemPreloads(query: ModelQueryBuilderContract<typeof Item>, keys: ItemPreloadKey[]) {
  for (const key of keys) {
    query.preload(key)
  }
}

export default class ItemRepository {
  query(options?: ModelAdapterOptions): ModelQueryBuilderContract<typeof Item> {
    return Item.query(options)
  }

  private baseListQuery(options?: ItemListOptions) {
    const { filters, preload } = options ?? {}
    const { categoryId, name } = filters ?? {}
    const keys = resolveItemPreloadKeys(preload)
    const query = this.query()
    applyItemPreloads(query, keys)

    if (categoryId !== undefined) {
      const ids = Array.isArray(categoryId) ? categoryId : [categoryId]
      if (ids.length === 1) {
        query.where('category_id', ids[0]!)
      } else if (ids.length > 1) {
        query.whereIn('category_id', ids)
      }
    }

    whereLikeAnyColumn(query, 'name', name)

    return query.orderBy('created_at', 'desc')
  }

  async paginate(options?: ItemListOptions) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 10
    return await this.baseListQuery(options).paginate(page, perPage)
  }

  async findById(id: string, options?: ItemFindOptions) {
    const keys = resolveItemPreloadKeys(options?.preload)
    const query = this.query().where('id', id)
    applyItemPreloads(query, keys)
    const item = await query.first()
    if (!item) throw new AppException('Item não encontrado', 404)
    return item
  }

  async findByIdInStore(
    id: string,
    storeId: string,
    options?: ItemFindOptions,
    trx?: TransactionClientContract
  ) {
    const keys = resolveItemPreloadKeys(options?.preload)
    const query = this.query(trx ? { client: trx } : undefined)
      .where('id', id)
      .whereHas('category', (q) => {
        q.where('store_id', storeId)
      })
    applyItemPreloads(query, keys)
    const item = await query.first()
    if (!item) throw new AppException('Item não encontrado', 404)
    return item
  }

  async requireById(id: string, trx?: TransactionClientContract) {
    const query = this.query({ client: trx }).where('id', id)
    const item = await query.first()
    if (!item) throw new AppException('Item não encontrado', 404)
    return item
  }

  async findByCategoryInStore(storeId: string, categoryId: number, options?: ItemFindOptions) {
    const keys =
      options?.preload === undefined
        ? (['addons'] as ItemPreloadKey[])
        : resolveItemPreloadKeys(options.preload)
    const query = this.query()
      .where('category_id', categoryId)
      .whereHas('category', (q) => {
        q.where('store_id', storeId)
      })
    applyItemPreloads(query, keys)
    return await query.orderBy('order', 'asc')
  }

  async findByCategory(categoryId: number, options?: ItemFindOptions) {
    const keys =
      options?.preload === undefined
        ? (['addons'] as ItemPreloadKey[])
        : resolveItemPreloadKeys(options.preload)
    const query = this.query().where('category_id', categoryId)
    applyItemPreloads(query, keys)
    return await query.orderBy('order', 'asc')
  }

  async findByStore(storeId: string, options?: ItemFindOptions) {
    const keys =
      options?.preload === undefined
        ? (['category'] as ItemPreloadKey[])
        : resolveItemPreloadKeys(options.preload)
    const query = this.query().whereHas('category', (q) => {
      q.where('store_id', storeId)
    })
    applyItemPreloads(query, keys)
    query.withCount('addons', (q) => {
      q.as('addonsCount')
    })
    return await query.orderBy('created_at', 'desc')
  }

  async paginateInStore(storeId: string, options?: ItemListOptions) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 10
    const keys =
      options?.preload === undefined
        ? (['category'] as ItemPreloadKey[])
        : resolveItemPreloadKeys(options.preload)
    const { categoryId, name, categoryName } = options?.filters ?? {}

    const query = this.query().whereHas('category', (q) => {
      q.where('store_id', storeId)
    })
    applyItemPreloads(query, keys)
    query.withCount('addons', (q) => {
      q.as('addonsCount')
    })

    if (categoryId !== undefined) {
      const ids = Array.isArray(categoryId) ? categoryId : [categoryId]
      if (ids.length === 1) {
        query.where('category_id', ids[0]!)
      } else if (ids.length > 1) {
        query.whereIn('category_id', ids)
      }
    }

    whereLikeAnyColumn(query, 'name', name)

    if (categoryName !== undefined) {
      const names = Array.isArray(categoryName) ? categoryName : [categoryName]
      if (names.length === 1) {
        query.whereHas('category', (cq) => {
          cq.where('store_id', storeId).where('name', names[0]!)
        })
      } else if (names.length > 1) {
        query.whereHas('category', (cq) => {
          cq.where('store_id', storeId).whereIn('name', names)
        })
      }
    }

    return await query.orderBy('created_at', 'desc').paginate(page, perPage)
  }

  async create(data: Partial<Item>, trx?: TransactionClientContract) {
    return await Item.create(data, trx ? { client: trx } : undefined)
  }

  async update(id: string, data: Partial<Item>, trx?: TransactionClientContract) {
    const item = await this.requireById(id, trx)
    item.merge(data)
    await item.save()
    return item
  }

  async delete(id: string, trx?: TransactionClientContract) {
    const item = await this.requireById(id, trx)
    await item.delete()
  }
}
