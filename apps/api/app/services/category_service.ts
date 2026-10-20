import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import { deleteEach } from '#helpers/bulk_delete'
import { applyOrder } from '#helpers/reorder'
import CategoryRepository from '#repositories/category_repository'
import type { CategoryFindOptions, CategoryListOptions } from '#types/category_query'

@inject()
export default class CategoryService {
  constructor(private repo: CategoryRepository) {}

  async list(options?: CategoryListOptions) {
    return await this.repo.paginate(options)
  }

  async get(id: number, options?: CategoryFindOptions) {
    return await this.repo.findById(id, options)
  }

  async getByStore(storeId: string, options?: CategoryFindOptions) {
    return await this.repo.findByStore(storeId, options)
  }

  async getInStore(storeId: string, id: number, options?: CategoryFindOptions) {
    return await this.repo.findByIdInStore(id, storeId, options)
  }

  async create(data: Partial<Category>) {
    return await db.transaction(async (trx) => {
      const storeId = data.storeId!
      const maxOrder = await this.repo.getMaxOrderByStore(storeId)
      const nextOrder = maxOrder + 1

      return await this.repo.create({ ...data, order: nextOrder }, trx)
    })
  }

  async update(id: number, data: Partial<Category>) {
    return await db.transaction(async (trx) => {
      return await this.repo.update(id, data, trx)
    })
  }

  async updateInStore(storeId: string, id: number, data: Partial<Category>) {
    return await db.transaction(async (trx) => {
      await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      return await this.repo.update(id, data, trx)
    })
  }

  async remove(id: number) {
    return await db.transaction(async (trx) => {
      await this.repo.delete(id, trx)
    })
  }

  async removeInStore(storeId: string, id: number) {
    return await db.transaction(async (trx) => {
      await this.repo.findByIdInStore(id, storeId, { preload: false }, trx)
      await this.repo.delete(id, trx)
    })
  }

  async reorderInStore(storeId: string, ids: number[]) {
    await db.transaction(async (trx) => {
      await applyOrder(Category.query().where('store_id', storeId), ids, trx)
    })
  }

  async bulkDeleteForStore(storeId: string, ids: number[]) {
    const categories = await Category.query().whereIn('id', ids).where('store_id', storeId)

    return await deleteEach(categories)
  }

  async all(options?: CategoryFindOptions) {
    return await this.repo.all(options)
  }
}
