import User from '#models/user'
import type { ModelAdapterOptions, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import { whereLikeAnyColumn } from '#helpers/list_filter_query'
import type {
  UserFindOptions,
  UserListOptions,
  UserPreloadKey,
  UserPreloadOption,
} from '#types/user_query'

function resolveUserPreloadKeys(preload: UserPreloadOption | undefined): UserPreloadKey[] {
  if (preload === false) return []
  if (preload === true || preload === undefined) return ['stores']
  return preload
}

function applyUserPreloads(query: ModelQueryBuilderContract<typeof User>, keys: UserPreloadKey[]) {
  for (const key of keys) {
    query.preload(key)
  }
}

export default class UserRepository {
  query(options?: ModelAdapterOptions): ModelQueryBuilderContract<typeof User> {
    return User.query(options)
  }

  private baseListQuery(options?: UserListOptions) {
    const { filters, preload } = options ?? {}
    const { name, email } = filters ?? {}
    const keys = resolveUserPreloadKeys(preload)
    const query = this.query()
    applyUserPreloads(query, keys)

    whereLikeAnyColumn(query, 'name', name)
    whereLikeAnyColumn(query, 'email', email)

    return query.orderBy('created_at', 'desc')
  }

  async paginate(options?: UserListOptions) {
    const page = options?.page ?? 1
    const perPage = options?.perPage ?? 10
    return await this.baseListQuery(options).paginate(page, perPage)
  }

  async findById(id: string, options?: UserFindOptions) {
    const keys = resolveUserPreloadKeys(options?.preload)
    const query = this.query().where('id', id)
    applyUserPreloads(query, keys)
    const user = await query.first()
    if (!user) throw new AppException('Usuário não encontrado', 404)
    return user
  }

  async requireById(id: string, trx?: TransactionClientContract) {
    const query = this.query({ client: trx }).where('id', id)
    const user = await query.first()
    if (!user) throw new AppException('Usuário não encontrado', 404)
    return user
  }

  async create(data: Partial<User>, trx?: TransactionClientContract) {
    return await User.create(data, trx ? { client: trx } : undefined)
  }

  async update(id: string, data: Partial<User>, trx?: TransactionClientContract) {
    const user = await this.requireById(id, trx)
    user.merge(data)
    await user.save()
    return user
  }

  async delete(id: string, trx?: TransactionClientContract) {
    const user = await this.requireById(id, trx)
    await user.delete()
  }
}
