import { DateTime } from 'luxon'
import {
  BaseModel,
  beforeSave,
  beforeUpdate,
  column,
  computed,
  hasMany,
  manyToMany,
} from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import StoreStatus from '../enums/store-status.js'
import Category from './category.js'
import Addon from './addon.js'
import { getSocket } from '#start/ws'
import User from './user.js'
import StoreViews from './store_views.js'

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

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Category)
  declare categories: HasMany<typeof Category>

  @hasMany(() => Addon)
  declare addons: HasMany<typeof Addon>

  @manyToMany(() => User)
  declare users: ManyToMany<typeof User>

  @hasMany(() => StoreViews)
  declare storeViews: HasMany<typeof StoreViews>

  @beforeSave()
  public static async ensureSingleDefault(store: Store) {
    if (store.isDefault) {
      await Store.query()
        .whereNot('id', store.id || 0)
        .update({ isDefault: false })
    }
  }

  @beforeUpdate()
  public static async notifyStatusUpdate(store: Store) {
    if (store.$dirty.status) {
      const io = getSocket()

      io.to(`store-${store.id}`).emit('store-status', {
        storeId: store.id,
        status: store.status,
      })
    }
  }

  @computed()
  get views() {
    return Number(this.$extras.storeViews_count || 0)
  }

  public async loadStoreViewsCount() {
    const store: Store = this
    await store.loadCount('storeViews')
    return Number(this.$extras.storeViews_count || 0)
  }

  public async incrementViews() {
    const store: Store = this
    await store.related('storeViews').create({})
    return store
  }
}
