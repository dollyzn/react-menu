import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, computed, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Role from '#models/role'
import Permission from '#models/permission'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { UserStatusEnum } from '#enums/user_status'
import StoreRole from '#enums/store_role'
import PushRegistration from '#models/push_registration'
import UserSocialAccount from '#models/user_social_account'
import Store from './store.js'

/**
 * Lifetime of an access token and of the auth cookie that carries it.
 */
export const SESSION_TTL = '7 days'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  public static table = 'users'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare roleId: number

  @column()
  declare name: string | null

  @computed()
  public get firstName() {
    return this.name?.split(' ')?.[0] || null
  }

  @column()
  declare email: string

  @column()
  declare phone: string | null

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare avatarUrl: string | null

  @column()
  declare status: UserStatusEnum

  @column()
  declare superUser: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  @hasMany(() => PushRegistration)
  declare pushRegistrations: HasMany<typeof PushRegistration>

  @hasMany(() => UserSocialAccount)
  declare socialAccounts: HasMany<typeof UserSocialAccount>

  /** Pivot `role`: StoreRole of the user in each store. */
  @manyToMany(() => Store, { pivotColumns: ['role'] })
  declare stores: ManyToMany<typeof Store>

  async can(access: string): Promise<boolean> {
    if (this.superUser) return true

    await (this as User).load('role', (query) => {
      query.preload('permissions')
    })

    return (
      this.role?.permissions?.some((permission: Permission) => permission.name === access) ?? false
    )
  }

  async hasStoreAccess(storeId: string): Promise<boolean> {
    if (this.superUser) return true

    const membership = await (this as User)
      .related('stores')
      .query()
      .where('stores.id', storeId)
      .select('stores.id')
      .first()

    return Boolean(membership)
  }

  /** The user's role in a store; super users act as managers everywhere. */
  async storeRole(storeId: string): Promise<StoreRole | null> {
    if (this.superUser) return StoreRole.MANAGER

    const store = await (this as User)
      .related('stores')
      .query()
      .where('stores.id', storeId)
      .select('stores.id')
      .first()

    return (store?.$extras.pivot_role as StoreRole | undefined) ?? null
  }

  static accessTokens = DbAccessTokensProvider.forModel(User, { expiresIn: SESSION_TTL })
}
