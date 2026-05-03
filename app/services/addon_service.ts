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

  async get(id: string, options?: AddonFindOptions) {
    return await this.repo.findById(id, options)
  }

  async getByStore(storeId: string, options?: AddonFindOptions) {
    return await this.repo.findByStore(storeId, options)
  }

  async getByItem(itemId: string, options?: AddonFindOptions) {
    return await this.repo.findByItemId(itemId, options)
  }

  async create(data: Partial<Addon>) {
    return await db.transaction(async (trx) => {
      return await this.repo.create(data, trx)
    })
  }

  async update(id: string, data: Partial<Addon>) {
    return await db.transaction(async (trx) => {
      return await this.repo.update(id, data, trx)
    })
  }

  async remove(id: string) {
    return await db.transaction(async (trx) => {
      await this.repo.delete(id, trx)
    })
  }
}
