import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column, computed, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import encryption from '@adonisjs/core/services/encryption'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import StoreStatus from '../enums/store_status.js'
import Category from './category.js'
import Addon from './addon.js'
import User from './user.js'
import db from '@adonisjs/lucid/services/db'

const encryptNullable = (value: string | null) => (value ? encryption.encrypt(value) : null)
const decryptNullable = (value: string | null) =>
  value ? (encryption.decrypt<string>(value) ?? null) : null

export default class Store extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  @column()
  declare status: StoreStatus

  @column()
  declare address: string | null

  @column()
  declare instagramUrl: string | null

  @column()
  declare ifoodUrl: string | null

  @column()
  declare bannerUrl: string | null

  @column()
  declare photoUrl: string | null

  @column()
  declare slug: string

  @column()
  declare isDefault: boolean

  @column()
  declare phone: string | null

  @column()
  declare description: string | null

  @column()
  declare pickupEtaMinutes: number

  @column()
  declare inventoryEnabled: boolean

  @column()
  declare counterPaymentEnabled: boolean

  /** Later orders the kitchen may pull identical pastries from (0 = arrival order). */
  @column()
  declare kitchenBatchLookahead: number

  /** Encrypted at rest with APP_KEY; never serialized. */
  @column({ serializeAs: null, prepare: encryptNullable, consume: decryptNullable })
  declare mercadoPagoAccessToken: string | null

  @column({ serializeAs: null, prepare: encryptNullable, consume: decryptNullable })
  declare mercadoPagoWebhookSecret: string | null

  /** Card installments offered at checkout (1 = à vista only). */
  @column()
  declare maxInstallments: number

  /** Public key for the card form (Card Payment Brick); safe to expose. */
  @column()
  declare mercadoPagoPublicKey: string | null

  @computed()
  get mercadoPagoEnabled() {
    return Boolean(this.mercadoPagoAccessToken)
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Category)
  declare categories: HasMany<typeof Category>

  @hasMany(() => Addon)
  declare addons: HasMany<typeof Addon>

  /** Pivot `role`: StoreRole of each member. */
  @manyToMany(() => User, { pivotColumns: ['role'] })
  declare users: ManyToMany<typeof User>

  @beforeSave()
  public static async ensureSingleDefault(store: Store) {
    if (store.isDefault && store.$dirty.isDefault) {
      await Store.query({ client: store.$trx })
        .where('isDefault', true)
        .if(store.$isPersisted, (query) => query.whereNot('id', store.id))
        .update({ isDefault: false })
    }
  }

  /** One more menu visit this hour (a single row per store/hour/platform). */
  public async incrementViews(platform: 'mobile' | 'desktop') {
    await db.rawQuery(
      `insert into store_view_counts (store_id, hour, platform, count)
       values (?, date_trunc('hour', now()), ?, 1)
       on conflict (store_id, hour, platform)
       do update set count = store_view_counts.count + 1`,
      [this.id, platform]
    )
  }
}
