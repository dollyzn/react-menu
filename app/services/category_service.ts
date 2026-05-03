import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
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

  async remove(id: number) {
    return await db.transaction(async (trx) => {
      await this.repo.delete(id, trx)
    })
  }

  async updateOrder(id: number, newOrder: number) {
    return await db.transaction(async (trx) => {
      const category = await this.repo.requireById(id, trx)

      if (newOrder < category.order) {
        await Category.query({ client: trx })
          .where('store_id', category.storeId)
          .whereBetween('order', [newOrder, category.order - 1])
          .increment('order', 1)
      } else if (newOrder > category.order) {
        await Category.query({ client: trx })
          .where('store_id', category.storeId)
          .whereBetween('order', [category.order + 1, newOrder])
          .decrement('order', 1)
      }

      return await this.repo.update(id, { order: newOrder }, trx)
    })
  }

  async bulkDelete(ids: number[]) {
    const categories = await Category.query().whereIn('id', ids)

    const deletedCategories: Category[] = []
    const failedDeletions: Category[] = []

    for (const category of categories) {
      try {
        await category.delete()
        deletedCategories.push(category)
      } catch {
        failedDeletions.push(category)
      }
    }

    return {
      deletedCategories,
      failedDeletions,
    }
  }

  async all(options?: CategoryFindOptions) {
    return await this.repo.all(options)
  }
}
