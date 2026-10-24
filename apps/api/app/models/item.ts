import { DateTime } from 'luxon'
import { decimal } from '#helpers/columns'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Category from './category.js'
import Addon from './addon.js'
import Ingredient from './ingredient.js'
import OptionGroup from './option_group.js'

export default class Item extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare categoryId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column(decimal)
  declare price: number

  @column()
  declare photoUrl: string | null

  @column()
  declare views: number

  @column()
  declare order: number

  @column()
  declare isAvailable: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @manyToMany(() => Addon)
  declare addons: ManyToMany<typeof Addon>

  /** Choice groups the customer fills in (pivot `order`). */
  @manyToMany(() => OptionGroup, { pivotTable: 'item_option_groups', pivotColumns: ['order'] })
  declare optionGroups: ManyToMany<typeof OptionGroup>

  /** Recipe: ingredients consumed per unit (pivot `quantity`). */
  @manyToMany(() => Ingredient, { pivotTable: 'item_ingredients', pivotColumns: ['quantity'] })
  declare ingredients: ManyToMany<typeof Ingredient>

  serializeExtras() {
    const addonsCount = this.$extras.addonsCount ? Number(this.$extras.addonsCount) : undefined

    return {
      addonsCount,
    }
  }
}
