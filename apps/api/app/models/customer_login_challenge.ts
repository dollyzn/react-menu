import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export const LoginMethod = {
  /** The customer sends us a code from their WhatsApp (free, proves the number). */
  MESSAGE: 'message',
  /** We send a code (authentication template) and the customer types it. */
  CODE: 'code',
} as const
export type LoginMethod = (typeof LoginMethod)[keyof typeof LoginMethod]

/** A customer proving their phone to open their order history (ADR 0025). */
export default class CustomerLoginChallenge extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare storeId: string

  @column()
  declare method: LoginMethod

  @column()
  declare code: string | null

  @column({ serializeAs: null })
  declare codeHash: string | null

  @column({ serializeAs: null })
  declare secretHash: string

  @column()
  declare phone: string | null

  /** SHA-256 of the Idempotency-Key that started it (a repeat returns it again). */
  @column({ serializeAs: null })
  declare startKeyHash: string | null

  /** SHA-256 of the Idempotency-Key that claimed it, and the session it opened. */
  @column({ serializeAs: null })
  declare claimKeyHash: string | null

  @column({ serializeAs: null })
  declare sessionId: string | null

  @column()
  declare attempts: number

  @column.dateTime()
  declare verifiedAt: DateTime | null

  @column.dateTime()
  declare claimedAt: DateTime | null

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  get isExpired() {
    return this.expiresAt <= DateTime.now()
  }
}
