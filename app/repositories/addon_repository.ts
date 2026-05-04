import Addon from '#models/addon'
import type { ModelAdapterOptions, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import { whereEqOrInColumn, whereLikeAnyColumn } from '#helpers/list_filter_query'
import type {
  AddonFindOptions,
  AddonListOptions,
  AddonPreloadKey,
  AddonPreloadOption,
} from '#types/addon_query'

function resolveAddonPreloadKeys(preload: AddonPreloadOption | undefined): AddonPreloadKey[] {
  if (preload === false) return []
  if (preload === true || preload === undefined) return ['items']
  return preload
}

function applyAddonPreloads(
  query: ModelQueryBuilderContract<typeof Addon>,
  keys: AddonPreloadKey[]
) {
  for (const key of keys) {
    query.preload(key)
  }
}

export default class AddonRepository {
  query(options?: ModelAdapterOptions): ModelQueryBuilderContract<typeof Addon> {
    return Addon.query(options)
  }

  private baseListQuery(options?: AddonListOptions) {
    const { filters, preload } = options ?? {}
    const { storeId, name } = filters ?? {}
    const keys = resolveAddonPreloadKeys(preload)
    const query = this.query()
    applyAddonPreloads(query, keys)

    whereEqOrInColumn(query, 'store_id', storeId)
    whereLikeAnyColumn(query, 'name', name)

    return query.orderBy('created_at', 'desc')
  }

  async paginate(options?: AddonListOptions) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 10
    return await this.baseListQuery(options).paginate(page, perPage)
  }

  async findById(id: string, options?: AddonFindOptions) {
    const keys = resolveAddonPreloadKeys(options?.preload)
    const query = this.query().where('id', id)
    applyAddonPreloads(query, keys)
    const addon = await query.first()
    if (!addon) throw new AppException('Complemento não encontrado', 404)
    return addon
  }

  async findByIdInStore(
    id: string,
    storeId: string,
    options?: AddonFindOptions,
    trx?: TransactionClientContract
  ) {
    const keys = resolveAddonPreloadKeys(options?.preload)
    const query = this.query(trx ? { client: trx } : undefined).where('id', id).where('store_id', storeId)
    applyAddonPreloads(query, keys)
    const addon = await query.first()
    if (!addon) throw new AppException('Complemento não encontrado', 404)
    return addon
  }

  async requireById(id: string, trx?: TransactionClientContract) {
    const query = this.query({ client: trx }).where('id', id)
    const addon = await query.first()
    if (!addon) throw new AppException('Complemento não encontrado', 404)
    return addon
  }

  async findByStore(storeId: string, options?: AddonFindOptions) {
    const keys = resolveAddonPreloadKeys(options?.preload ?? true)
    const query = this.query().where('store_id', storeId)
    applyAddonPreloads(query, keys)
    return await query.orderBy('created_at', 'desc')
  }

  async findByItemId(itemId: string, options?: AddonFindOptions) {
    const keys = resolveAddonPreloadKeys(options?.preload ?? false)
    const query = this.query().whereHas('items', (q) => {
      q.where('items.id', itemId)
    })
    applyAddonPreloads(query, keys)
    return await query.orderBy('created_at', 'desc')
  }

  async findByItemIdInStore(itemId: string, storeId: string, options?: AddonFindOptions) {
    const keys = resolveAddonPreloadKeys(options?.preload ?? false)
    const query = this.query().where('store_id', storeId).whereHas('items', (q) => {
      q.where('items.id', itemId).whereHas('category', (cq) => {
        cq.where('store_id', storeId)
      })
    })
    applyAddonPreloads(query, keys)
    return await query.orderBy('created_at', 'desc')
  }

  async create(data: Partial<Addon>, trx?: TransactionClientContract) {
    return await Addon.create(data, trx ? { client: trx } : undefined)
  }

  async update(id: string, data: Partial<Addon>, trx?: TransactionClientContract) {
    const addon = await this.requireById(id, trx)
    addon.merge(data)
    await addon.save()
    return addon
  }

  async delete(id: string, trx?: TransactionClientContract) {
    const addon = await this.requireById(id, trx)
    await addon.delete()
  }

  async findByIds(ids: string[]) {
    return await this.query().whereIn('id', ids)
  }
}
