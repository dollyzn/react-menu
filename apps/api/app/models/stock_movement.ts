import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type StockMovementType from '#enums/stock_movement_type'
import { decimal } from '#helpers/columns'
import Ingredient from '#models/ingredient'

export default class StockMovement extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare storeId: string

  @column()
  declare ingredientId: number

  @column()
  declare type: StockMovementType

  /** Signed: positive adds stock, negative removes it. */
  @column(decimal)
  declare quantity: number

  @column()
  declare orderId: string | null

  @column()
  declare userId: string | null

  @column()
  declare note: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Ingredient)
  declare ingredient: BelongsTo<typeof Ingredient>
}
