import { inject } from '@adonisjs/core'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import db from '@adonisjs/lucid/services/db'
import Addon from '#models/addon'
import { deleteEach } from '#helpers/bulk_delete'
import { deleteUpload } from '#helpers/uploads'
import { clearPhoto, replacePhoto } from '#helpers/photos'
import { applyBulkChanges, type BulkChange } from '#helpers/bulk_update'
import AddonRepository from '#repositories/addon_repository'
import type { AddonFindOptions, AddonListOptions } from '#types/addon_query'

/** Drive prefix of add-on photos uploaded in the panel (only those are ever deleted). */
const PHOTO_PREFIX = 'addons'

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
    const photoUrl = await db.transaction(async (trx) => {
      const addon = await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      await this.repo.delete(id, trx)
      return addon.photoUrl
    })
    await deleteUpload(photoUrl, PHOTO_PREFIX)
  }

  /**
   * Replaces the add-on's photo, like an item's: the new file is stored and
   * saved first and the old one deleted after (an orphan file at worst).
   */
  async setPhoto(storeId: string, id: string, photo: MultipartFile) {
    const addon = await this.repo.findByIdInStore(id, storeId, { preload: false })
    await replacePhoto(addon, PHOTO_PREFIX, photo)
    return addon
  }

  /** Back to no photo. Repeating it is harmless. */
  async removePhoto(storeId: string, id: string) {
    const addon = await this.repo.findByIdInStore(id, storeId, { preload: false })
    await clearPhoto(addon, PHOTO_PREFIX)
    return addon
  }

  /** Prices/availability of many add-ons at once, all or nothing (see applyBulkChanges). */
  async bulkUpdateForStore(storeId: string, changes: BulkChange[]) {
    return await db.transaction(async (trx) => {
      const addons = await Addon.query({ client: trx })
        .whereIn(
          'id',
          changes.map((change) => change.id)
        )
        .where('store_id', storeId)
        .forUpdate()
      return await applyBulkChanges(addons, changes, trx)
    })
  }

  async bulkDeleteForStore(storeId: string, ids: string[]) {
    const addons = await Addon.query().whereIn('id', ids).where('store_id', storeId)

    const result = await deleteEach(addons)
    for (const addon of result.deleted) await deleteUpload(addon.photoUrl, PHOTO_PREFIX)
    return result
  }
}
