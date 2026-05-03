import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Item from '#models/item'
import Category from '#models/category'
import ItemRepository from '#repositories/item_repository'
import AddonRepository from '#repositories/addon_repository'
import AppException from '#exceptions/app_exception'
import type { ItemFindOptions, ItemListOptions } from '#types/item_query'

@inject()
export default class ItemService {
  constructor(
    private repo: ItemRepository,
    private addonRepo: AddonRepository
  ) {}

  async list(options?: ItemListOptions) {
    return await this.repo.paginate(options)
  }

  async get(id: string, options?: ItemFindOptions) {
    const item = await this.repo.findById(id, options)
    await item.incrementViews()
    return item
  }

  async getByCategory(categoryId: number, options?: ItemFindOptions) {
    return await this.repo.findByCategory(categoryId, options)
  }

  async getByStore(storeId: string, options?: ItemFindOptions) {
    return await this.repo.findByStore(storeId, options)
  }

  async create(data: Partial<Item> & { addonIds?: string[] }) {
    return await db.transaction(async (trx) => {
      const { addonIds, ...itemData } = data
      const item = await this.repo.create(itemData, trx)

      if (addonIds && addonIds.length > 0) {
        const storeId = await this.resolveStoreIdForCategory(item.categoryId, trx)
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

  async update(id: string, data: Partial<Item> & { addonIds?: string[] }) {
    return await db.transaction(async (trx) => {
      const { addonIds, ...itemData } = data
      const item = await this.repo.update(id, itemData, trx)

      if (addonIds !== undefined) {
        const storeId = await this.resolveStoreIdForCategory(item.categoryId, trx)
        const validAddonIds =
          addonIds.length === 0 ? [] : await this.getValidAddonIds(addonIds, storeId, trx)
        await item.useTransaction(trx).related('addons').sync(validAddonIds)
      }

      await item.load('category')
      await item.load('addons')
      return item
    })
  }

  async updateOrder(id: string, newOrder: number) {
    return await db.transaction(async (trx) => {
      const item = await this.repo.requireById(id, trx)
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

  async remove(id: string) {
    return await db.transaction(async (trx) => {
      await this.repo.delete(id, trx)
    })
  }

  /**
   * Loja dona dos addons = loja da categoria do item (nunca confiar em storeId vindo do cliente).
   */
  private async resolveStoreIdForCategory(
    categoryId: number | undefined,
    trx?: TransactionClientContract
  ): Promise<string> {
    if (categoryId === undefined) {
      throw new AppException('Categoria é obrigatória para o item', 400)
    }

    const query = Category.query({ client: trx }).where('id', categoryId).select('id', 'store_id')

    const category = await query.first()
    if (!category) {
      throw new AppException('Categoria não encontrada', 404)
    }
    return category.storeId
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
