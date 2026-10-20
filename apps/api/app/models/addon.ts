import { DateTime } from 'luxon'
import { decimal } from '#helpers/columns'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Item from './item.js'
import Store from './store.js'
import Ingredient from './ingredient.js'

export default class Addon extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare storeId: string

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column(decimal)
  declare price: number

  @column()
  declare photoUrl: string | null

  @column()
  declare isAvailable: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>

  @manyToMany(() => Item)
  declare items: ManyToMany<typeof Item>

  /** Recipe: ingredients consumed per unit (pivot `quantity`). */
  @manyToMany(() => Ingredient, { pivotTable: 'addon_ingredients', pivotColumns: ['quantity'] })
  declare ingredients: ManyToMany<typeof Ingredient>
}
