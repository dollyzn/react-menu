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
import PushSubscription from '#models/push_subscription'
import UserSocialAccount from '#models/user_social_account'
import Store from './store.js'

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

  @hasMany(() => PushSubscription)
  declare pushSubscriptions: HasMany<typeof PushSubscription>

  @hasMany(() => UserSocialAccount)
  declare socialAccounts: HasMany<typeof UserSocialAccount>

  @manyToMany(() => Store)
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

  static accessTokens = DbAccessTokensProvider.forModel(User)
}
