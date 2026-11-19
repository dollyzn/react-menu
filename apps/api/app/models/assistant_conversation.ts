import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { UIMessage } from 'ai'

const json = <T>(fallback: T) => ({
  prepare: (value: T | null) => (value === null ? null : JSON.stringify(value ?? fallback)),
})

/** One person's conversation with the store assistant (see the migration). */
export default class AssistantConversation extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare storeId: string

  @column()
  declare userId: string

  @column()
  declare title: string | null

  @column({ ...json<UIMessage[]>([]), serializeAs: null })
  declare uiMessages: UIMessage[]

  @column.dateTime({ serializeAs: null })
  declare busyUntil: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
