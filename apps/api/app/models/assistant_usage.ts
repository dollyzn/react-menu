import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * One request to the store assistant, with its tokens. Only new questions
 * count toward the store's daily limit; an approval answered doesn't.
 */
export default class AssistantUsage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare storeId: string

  @column()
  declare userId: string | null

  @column()
  declare conversationId: string | null

  @column()
  declare model: string

  @column()
  declare question: boolean

  @column()
  declare inputTokens: number

  @column()
  declare outputTokens: number

  /** Part of the output tokens the model spent thinking. */
  @column()
  declare reasoningTokens: number

  @column()
  declare cacheReadTokens: number

  @column()
  declare cacheWriteTokens: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
