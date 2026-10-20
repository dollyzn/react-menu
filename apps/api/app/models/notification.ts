import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { NotificationCategory, NotificationType } from '#notifications/templates'
import User from '#models/user'
import Store from '#models/store'

/**
 * A notification as delivered to one user. Title, body and url are rendered
 * from its template at creation time, so history doesn't change when a
 * template does.
 */
export default class Notification extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare storeId: string | null

  @column()
  declare type: NotificationType

  @column()
  declare category: NotificationCategory

  @column()
  declare title: string

  @column()
  declare body: string

  @column()
  declare url: string | null

  @column({ prepare: (value: Record<string, unknown>) => JSON.stringify(value) })
  declare data: Record<string, unknown>

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>
}
