import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import encryption from '@adonisjs/core/services/encryption'
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
 * Lifetime of an access token and of the auth cookie that carries it. Used
 * again after half of it (7 days), the session renews for another 14.
 */
export const SESSION_TTL = '14 days'

const encryptNullable = (value: string | null) => (value ? encryption.encrypt(value) : null)
const decryptNullable = (value: string | null) =>
  value ? (encryption.decrypt<string>(value) ?? null) : null

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

  /** TOTP secret (base32), encrypted at rest with APP_KEY; never serialized. */
  @column({ serializeAs: null, prepare: encryptNullable, consume: decryptNullable })
  declare twoFactorSecret: string | null

  /** A secret shown during setup, waiting for its first code. */
  @column({ serializeAs: null, prepare: encryptNullable, consume: decryptNullable })
  declare twoFactorPendingSecret: string | null

  @column.dateTime({ serializeAs: null })
  declare twoFactorEnabledAt: DateTime | null

  /** The last TOTP time step accepted: a code works only once. */
  @column({ serializeAs: null })
  declare twoFactorLastStep: number | null

  /** An authenticator app is set up (otherwise sign-ins get an e-mail code). */
  @computed()
  get twoFactorEnabled() {
    return Boolean(this.twoFactorEnabledAt)
  }

  @column()
  declare status: UserStatusEnum

  @column()
  declare superUser: boolean

  /** Invited to a store and hasn't set a password or signed in yet. */
  @column()
  declare invitePending: boolean

  /** Proved they read this inbox (invite/reset link, e-mail code, Google). */
  @column.dateTime()
  declare emailVerifiedAt: DateTime | null

  /** Last authenticated activity (the panel pings while open); see presence.ts. */
  @column.dateTime({ serializeAs: null })
  declare lastSeenAt: DateTime | null

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

  /**
   * Pivot `role`: StoreRole of the user in each store, including stores the
   * managers switched off for them (`disabled_at`). Access checks use
   * `activeStores`.
   */
  @manyToMany(() => Store, { pivotColumns: ['role', 'disabled_at'] })
  declare stores: ManyToMany<typeof Store>

  /** The stores the user can work in (`stores` minus the switched-off ones). */
  @manyToMany(() => Store, {
    pivotTable: 'store_user',
    pivotColumns: ['role'],
    onQuery: (query) => query.whereNullPivot('disabled_at'),
  })
  declare activeStores: ManyToMany<typeof Store>

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
      .related('activeStores')
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
      .related('activeStores')
      .query()
      .where('stores.id', storeId)
      .select('stores.id')
      .first()

    return (store?.$extras.pivot_role as StoreRole | undefined) ?? null
  }

  static accessTokens = DbAccessTokensProvider.forModel(User, { expiresIn: SESSION_TTL })
}
