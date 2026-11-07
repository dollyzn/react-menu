import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type ChannelChoices = Record<string, { push?: boolean; email?: boolean }>

/** A person's notification choices (one row, created on first save). */
export default class NotificationPreference extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: string

  /** Per notification type, only what differs from the template's defaults. */
  @column({ prepare: (value: ChannelChoices) => JSON.stringify(value ?? {}) })
  declare channels: ChannelChoices

  @column({ prepare: (value: string[]) => JSON.stringify(value ?? []) })
  declare mutedStoreIds: string[]

  @column()
  declare dailySummary: boolean

  @column()
  declare dailySummaryHour: number

  @column.date()
  declare dailySummarySentOn: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
