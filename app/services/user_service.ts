import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import UserRepository from '#repositories/user_repository'
import type { UserFindOptions, UserListOptions } from '#types/user_query'

@inject()
export default class UserService {
  constructor(private repo: UserRepository) {}

  async list(options?: UserListOptions) {
    return await this.repo.paginate(options)
  }

  async get(id: string, options?: UserFindOptions) {
    return await this.repo.findById(id, options)
  }

  async create(data: Partial<User> & { storeIds?: string[] }) {
    return await db.transaction(async (trx) => {
      const { storeIds, ...userData } = data
      const user = await this.repo.create(userData, trx)

      if (storeIds && storeIds.length > 0) {
        await user.useTransaction(trx).related('stores').sync(storeIds)
      }

      return user
    })
  }

  async update(id: string, data: Partial<User> & { storeIds?: string[] }) {
    return await db.transaction(async (trx) => {
      const { storeIds, ...userData } = data
      const user = await this.repo.update(id, userData, trx)

      if (storeIds) {
        await user.useTransaction(trx).related('stores').sync(storeIds)
      }

      return user
    })
  }

  async remove(id: string) {
    return await db.transaction(async (trx) => {
      await this.repo.delete(id, trx)
    })
  }

  async syncStores(userId: string, storeIds: string[]) {
    return await db.transaction(async (trx) => {
      const user = await this.repo.requireById(userId, trx)
      await user.related('stores').sync(storeIds)
      return user
    })
  }
}
