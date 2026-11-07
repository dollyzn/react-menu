import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/** A Mercado Pago Point card machine the store charges from the POS (ADR 0020). */
export default class PointTerminal extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ serializeAs: null })
  declare storeId: string

  /** Mercado Pago's terminal id ("NEWLAND_N950__N950NCB123456789"). */
  @column()
  declare terminalId: string

  /** The staff's name for it ("Balcão"). */
  @column()
  declare name: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
