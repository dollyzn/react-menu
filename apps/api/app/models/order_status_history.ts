import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type OrderStatus from '#enums/order_status'
import User from '#models/user'

export default class OrderStatusHistory extends BaseModel {
  static table = 'order_status_histories'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orderId: string

  @column()
  declare fromStatus: OrderStatus | null

  @column()
  declare toStatus: OrderStatus

  @column()
  declare userId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  /** Who made the change (null: the customer or the system). */
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
