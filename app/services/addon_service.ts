import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Addon from '#models/addon'
import AddonRepository from '#repositories/addon_repository'
import type { AddonFindOptions, AddonListOptions } from '#types/addon_query'

@inject()
export default class AddonService {
  constructor(private repo: AddonRepository) {}

  async list(options?: AddonListOptions) {
    return await this.repo.paginate(options)
  }

  async listInStore(storeId: string, options?: AddonListOptions) {
    return await this.repo.paginate({
      ...options,
      filters: {
        ...options?.filters,
        storeId,
      },
    })
  }

  async getInStore(storeId: string, id: string, options?: AddonFindOptions) {
    return await this.repo.findByIdInStore(id, storeId, options)
  }

  async getByStore(storeId: string, options?: AddonFindOptions) {
    return await this.repo.findByStore(storeId, options)
  }

  async getByItemInStore(storeId: string, itemId: string, options?: AddonFindOptions) {
    return await this.repo.findByItemIdInStore(itemId, storeId, options)
  }

  async createForStore(storeId: string, data: Partial<Addon>) {
    return await db.transaction(async (trx) => {
      return await this.repo.create({ ...data, storeId }, trx)
    })
  }

  async updateInStore(storeId: string, id: string, data: Partial<Addon>) {
    return await db.transaction(async (trx) => {
      await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      return await this.repo.update(id, data, trx)
    })
  }

  async removeInStore(storeId: string, id: string) {
    return await db.transaction(async (trx) => {
      await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      await this.repo.delete(id, trx)
    })
  }

  async bulkDeleteForStore(storeId: string, ids: string[]) {
    const addons = await Addon.query().whereIn('id', ids).where('store_id', storeId)

    const deletedAddons: Addon[] = []
    const failedDeletions: Addon[] = []

    for (const addon of addons) {
      try {
        await addon.delete()
        deletedAddons.push(addon)
      } catch {
        failedDeletions.push(addon)
      }
    }

    return {
      deletedAddons,
      failedDeletions,
    }
  }
}
