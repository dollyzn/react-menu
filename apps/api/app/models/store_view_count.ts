import type { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** Menu visits of a store in one hour, per platform (aggregated). */
export default class StoreViewCount extends BaseModel {
  @column({ isPrimary: true })
  declare storeId: string

  @column.dateTime()
  declare hour: DateTime

  @column()
  declare platform: 'mobile' | 'desktop'

  @column()
  declare count: number
}
