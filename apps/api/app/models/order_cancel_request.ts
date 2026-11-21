import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type CancelRequestStatus from '#enums/cancel_request_status'
import Order from '#models/order'
import User from '#models/user'

/**
 * Someone who may not cancel an order asked a manager to (a partner past
 * their cancellation window, ADR 0024). At most one pending per order.
 */
export default class OrderCancelRequest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ serializeAs: null })
  declare storeId: string

  @column()
  declare orderId: string

  @column({ serializeAs: null })
  declare requestedById: string | null

  @column()
  declare reason: string

  @column()
  declare status: CancelRequestStatus

  @column({ serializeAs: null })
  declare decidedById: string | null

  @column.dateTime()
  declare decidedAt: DateTime | null

  @column()
  declare decisionNote: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  /** The contract's shape (names only for the people). */
  present() {
    const person = (user?: User | null) => (user ? { id: user.id, name: user.name } : null)
    return {
      id: this.id,
      orderId: this.orderId,
      reason: this.reason,
      status: this.status,
      requestedBy: person(this.requestedBy),
      decidedBy: person(this.decidedBy),
      decidedAt: this.decidedAt?.toISO() ?? null,
      decisionNote: this.decisionNote,
      createdAt: this.createdAt.toISO()!,
    }
  }

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => User, { foreignKey: 'requestedById' })
  declare requestedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'decidedById' })
  declare decidedBy: BelongsTo<typeof User>
}
