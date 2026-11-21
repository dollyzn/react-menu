import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { decimal } from '#helpers/columns'
import StorePartner from '#models/store_partner'
import User from '#models/user'

/**
 * A manager recorded that a partner's commission was paid (outside the
 * system) for some orders (ADR 0024). The orders point to it.
 */
export default class PartnerSettlement extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column({ serializeAs: null })
  declare storeId: string

  @column()
  declare partnerId: string

  /** Orders handed over up to this business day (null: picked one by one). */
  @column.date()
  declare until: DateTime | null

  @column()
  declare ordersCount: number

  @column(decimal)
  declare total: number

  @column()
  declare note: string | null

  @column.dateTime()
  declare paidAt: DateTime

  @column({ serializeAs: null })
  declare paidById: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => StorePartner, { foreignKey: 'partnerId' })
  declare partner: BelongsTo<typeof StorePartner>

  @belongsTo(() => User, { foreignKey: 'paidById' })
  declare paidBy: BelongsTo<typeof User>
}
