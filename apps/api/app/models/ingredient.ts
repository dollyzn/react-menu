import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type IngredientUnit from '#enums/ingredient_unit'
import { decimal } from '#helpers/columns'
import Store from '#models/store'

export default class Ingredient extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare storeId: string

  @column()
  declare name: string

  @column()
  declare unit: IngredientUnit

  @column(decimal)
  declare stockQuantity: number

  @column(decimal)
  declare minStock: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>

  @computed()
  get isLowStock() {
    return this.stockQuantity <= this.minStock
  }

  /** Recipe quantity when loaded through items/addons (pivot `quantity`). */
  serializeExtras() {
    const quantity = this.$extras.pivot_quantity
    return quantity === undefined ? {} : { quantity: Number(quantity) }
  }
}
