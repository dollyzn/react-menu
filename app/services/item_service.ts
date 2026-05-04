import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Item from '#models/item'
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
    const item = await this.repo.findByIdInStore(id, storeId, options)
    await item.incrementViews()
    return item
  }

  async getByStore(storeId: string, options?: ItemFindOptions) {
    return await this.repo.findByStore(storeId, options)
  }

  async getByCategoryInStore(storeId: string, categoryId: number, options?: ItemFindOptions) {
    await this.categoryRepo.findByIdInStore(categoryId, storeId, { preload: false })
    return await this.repo.findByCategoryInStore(storeId, categoryId, options)
  }

  async create(storeId: string, data: Partial<Item> & { addonIds?: string[] }) {
    return await db.transaction(async (trx) => {
      const { addonIds, ...itemData } = data
      await this.categoryRepo.findByIdInStore(itemData.categoryId!, storeId, { preload: false }, trx)

      const item = await this.repo.create(itemData, trx)

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
      await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      const { addonIds, ...itemData } = data
      if (itemData.categoryId !== undefined) {
        await this.categoryRepo.findByIdInStore(itemData.categoryId, storeId, { preload: false }, trx)
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

  async updateOrderInStore(storeId: string, id: string, newOrder: number) {
    return await db.transaction(async (trx) => {
      const item = await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      const categoryId = item.categoryId

      if (newOrder < item.order) {
        await this.repo
          .query({ client: trx })
          .where('category_id', categoryId)
          .whereBetween('order', [newOrder, item.order - 1])
          .increment('order', 1)
      } else if (newOrder > item.order) {
        await this.repo
          .query({ client: trx })
          .where('category_id', categoryId)
          .whereBetween('order', [item.order + 1, newOrder])
          .decrement('order', 1)
      }

      return await this.repo.update(id, { order: newOrder }, trx)
    })
  }

  async removeInStore(storeId: string, id: string) {
    return await db.transaction(async (trx) => {
      await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      await this.repo.delete(id, trx)
    })
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
