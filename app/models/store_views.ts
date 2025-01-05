import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import Store from './store.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class StoreViews extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare storeId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>
}
