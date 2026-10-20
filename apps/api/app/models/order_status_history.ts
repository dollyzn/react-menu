import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type OrderStatus from '#enums/order_status'

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
}
