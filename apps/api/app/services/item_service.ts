import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Item from '#models/item'
import { deleteEach } from '#helpers/bulk_delete'
import { applyBulkChanges, type BulkChange } from '#helpers/bulk_update'
import { applyOrder } from '#helpers/reorder'
import OptionGroupService from '#services/option_group_service'
import ItemRepository from '#repositories/item_repository'
import AddonRepository from '#repositories/addon_repository'
import CategoryRepository from '#repositories/category_repository'
import type { ItemFindOptions, ItemListOptions } from '#types/item_query'

@inject()
export default class ItemService {
  constructor(
    private repo: ItemRepository,
    private addonRepo: AddonRepository,
    private categoryRepo: CategoryRepository,
    private optionGroups: OptionGroupService
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

  async create(
    storeId: string,
    data: Partial<Item> & { addonIds?: string[]; optionGroupIds?: string[] }
  ) {
    return await db.transaction(async (trx) => {
      const { addonIds, optionGroupIds, ...itemData } = data
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

      if (optionGroupIds !== undefined)
        await this.syncOptionGroups(item, storeId, optionGroupIds, trx)

      await item.load('category')
      await item.load('addons')
      await item.load('optionGroups', (groups) => groups.orderBy('item_option_groups.order', 'asc'))
      return item
    })
  }

  async update(
    storeId: string,
    id: string,
    data: Partial<Item> & { addonIds?: string[]; optionGroupIds?: string[] }
  ) {
    return await db.transaction(async (trx) => {
      const current = await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      const { addonIds, optionGroupIds, ...itemData } = data
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

      if (optionGroupIds !== undefined)
        await this.syncOptionGroups(item, storeId, optionGroupIds, trx)

      await item.load('category')
      await item.load('addons')
      await item.load('optionGroups', (groups) => groups.orderBy('item_option_groups.order', 'asc'))
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

  /** Prices/availability of many items at once, all or nothing (see applyBulkChanges). */
  async bulkUpdateForStore(storeId: string, changes: BulkChange[]) {
    return await db.transaction(async (trx) => {
      const items = await Item.query({ client: trx })
        .whereIn(
          'id',
          changes.map((change) => change.id)
        )
        .whereHas('category', (q) => {
          q.where('store_id', storeId)
        })
        .forUpdate()
      return await applyBulkChanges(items, changes, trx)
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

  /** Attaches choice groups of this store to the item, in the given order. */
  private async syncOptionGroups(
    item: Item,
    storeId: string,
    ids: string[],
    trx: TransactionClientContract
  ) {
    const valid = await this.optionGroups.validIds(storeId, ids, trx)
    await item
      .useTransaction(trx)
      .related('optionGroups')
      .sync(Object.fromEntries(valid.map((groupId, order) => [groupId, { order }])))
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
