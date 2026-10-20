import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Item from '#models/item'
import { deleteEach } from '#helpers/bulk_delete'
import { applyOrder } from '#helpers/reorder'
import ItemRepository from '#repositories/item_repository'
import AddonRepository from '#repositories/addon_repository'
import CategoryRepository from '#repositories/category_repository'
import type { ItemFindOptions, ItemListOptions } from '#types/item_query'

@inject()
export default class ItemService {
  constructor(
    private repo: ItemRepository,
    private addonRepo: AddonRepository,
    private categoryRepo: CategoryRepository
  ) {}

  async list(options?: ItemListOptions) {
    return await this.repo.paginate(options)
  }

  async getInStore(storeId: string, id: string, options?: ItemFindOptions) {
    return await this.repo.findByIdInStore(id, storeId, options)
  }

  async getByStore(storeId: string, options?: ItemFindOptions) {
    return await this.repo.findByStore(storeId, options)
  }

  async listInStore(storeId: string, options?: ItemListOptions) {
    return await this.repo.paginateInStore(storeId, options)
  }

  async getByCategoryInStore(storeId: string, categoryId: number, options?: ItemFindOptions) {
    await this.categoryRepo.findByIdInStore(categoryId, storeId, { preload: false })
    return await this.repo.findByCategoryInStore(storeId, categoryId, options)
  }

  async create(storeId: string, data: Partial<Item> & { addonIds?: string[] }) {
    return await db.transaction(async (trx) => {
      const { addonIds, ...itemData } = data
      await this.categoryRepo.findByIdInStore(
        itemData.categoryId!,
        storeId,
        { preload: false },
        trx
      )

      const order = await this.repo.nextOrderInCategory(itemData.categoryId!, trx)
      const item = await this.repo.create({ ...itemData, order }, trx)

      if (addonIds && addonIds.length > 0) {
        const validAddonIds = await this.getValidAddonIds(addonIds, storeId, trx)
        if (validAddonIds.length > 0) {
          await item.useTransaction(trx).related('addons').sync(validAddonIds)
        }
      }

      await item.load('category')
      await item.load('addons')
      return item
    })
  }

  async update(storeId: string, id: string, data: Partial<Item> & { addonIds?: string[] }) {
    return await db.transaction(async (trx) => {
      const current = await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      const { addonIds, ...itemData } = data
      if (itemData.categoryId !== undefined && itemData.categoryId !== current.categoryId) {
        await this.categoryRepo.findByIdInStore(
          itemData.categoryId,
          storeId,
          { preload: false },
          trx
        )
        // Moving to another category appends the item to its end.
        itemData.order = await this.repo.nextOrderInCategory(itemData.categoryId, trx)
      }

      const item = await this.repo.update(id, itemData, trx)

      if (addonIds !== undefined) {
        const validAddonIds =
          addonIds.length === 0 ? [] : await this.getValidAddonIds(addonIds, storeId, trx)
        await item.useTransaction(trx).related('addons').sync(validAddonIds)
      }

      await item.load('category')
      await item.load('addons')
      return item
    })
  }

  async reorderInCategory(storeId: string, categoryId: number, ids: string[]) {
    await db.transaction(async (trx) => {
      await this.categoryRepo.findByIdInStore(categoryId, storeId, { preload: false }, trx)
      await applyOrder(this.repo.query().where('category_id', categoryId), ids, trx)
    })
  }

  async removeInStore(storeId: string, id: string) {
    return await db.transaction(async (trx) => {
      await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      await this.repo.delete(id, trx)
    })
  }

  async bulkDeleteForStore(storeId: string, ids: string[]) {
    const items = await this.repo
      .query()
      .whereIn('id', ids)
      .whereHas('category', (q) => {
        q.where('store_id', storeId)
      })

    return await deleteEach(items)
  }

  private async getValidAddonIds(
    addonIds: string[],
    storeId: string,
    trx?: TransactionClientContract
  ): Promise<string[]> {
    if (addonIds.length === 0) {
      return []
    }

    const query = this.addonRepo
      .query({ client: trx })
      .whereIn('id', addonIds)
      .andWhere('store_id', storeId)
      .select('id')

    const validAddons = await query
    return validAddons.map((addon) => addon.id)
  }
}
