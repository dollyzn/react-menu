import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { decimal } from '#helpers/columns'
import Item from '#models/item'
import Order from '#models/order'
import OrderItemAddon from '#models/order_item_addon'

/** A line of an order; name and prices are snapshots taken at checkout. */
export default class OrderItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orderId: string

  @column()
  declare itemId: string | null

  @column()
  declare name: string

  /**
   * The name on the staff screens (kitchen, board) when a choice renames the
   * item ("Pastel de Frango com Catupiry"); null = `name`. See
   * OptionGroup.replacesInName.
   */
  @column()
  declare displayName: string | null

  @column(decimal)
  declare unitPrice: number

  @column()
  declare quantity: number

  /** Units the kitchen has finished (0..quantity). */
  @column()
  declare preparedQuantity: number

  @column()
  declare requiresPreparation: boolean

  @column()
  declare notes: string | null

  /** (unit price + add-ons) × quantity. */
  @column(decimal)
  declare total: number

  @belongsTo(() => Order)
  declare order: BelongsTo<typeof Order>

  @belongsTo(() => Item)
  declare item: BelongsTo<typeof Item>

  @hasMany(() => OrderItemAddon)
  declare addons: HasMany<typeof OrderItemAddon>
}
