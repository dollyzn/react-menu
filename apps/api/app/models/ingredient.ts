import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, computed } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type IngredientUnit from '#enums/ingredient_unit'
import { decimal } from '#helpers/columns'
import { ingredientBadge } from '#kitchen/ingredient_icons'
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

  /**
   * The manager's picks for the badge (see #kitchen/ingredient_icons); null =
   * automatic from the name. A label of `false` = no tag (stored as "").
   */
  @column()
  declare icon: string | null

  @column()
  declare iconColor: string | null

  @column({
    prepare: (value: string | false | null) => (value === false ? '' : value),
    consume: (value: string | null) => (value === '' ? false : value),
  })
  declare iconLabel: string | false | null

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

  /** What the panel and the kitchen show. */
  @computed()
  get badge() {
    return ingredientBadge(this.name, this)
  }

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
