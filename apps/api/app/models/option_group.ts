import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Addon from './addon.js'
import Item from './item.js'
import Store from './store.js'

/**
 * What an option costs in a group loaded with its pivot: the group's price,
 * or the add-on's own when the group leaves it empty.
 */
export function optionPrice(option: Addon) {
  const price = option.$extras.pivot_price
  return price === null || price === undefined ? option.price : Number(price)
}

/**
 * A choice group ("Escolha o queijo": choose 1; "Molhos": up to 2). Its
 * options are the store's add-ons (pivot `order`), so price, recipe and
 * stock come from them (the pivot `price` overrides the add-on's in this
 * group); items use it through `item_option_groups`.
 */
export default class OptionGroup extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare storeId: string

  @column()
  declare name: string

  /** 0 = optional; 1+ = the customer must pick at least that many. */
  @column()
  declare minChoices: number

  @column()
  declare maxChoices: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>

  @manyToMany(() => Addon, { pivotTable: 'option_group_addons', pivotColumns: ['order', 'price'] })
  declare options: ManyToMany<typeof Addon>

  @manyToMany(() => Item, { pivotTable: 'item_option_groups', pivotColumns: ['order'] })
  declare items: ManyToMany<typeof Item>

  /** How many items use it (from `withCount('items')`). */
  serializeExtras() {
    return this.$extras.items_count === undefined
      ? {}
      : { itemsCount: Number(this.$extras.items_count) }
  }
}
