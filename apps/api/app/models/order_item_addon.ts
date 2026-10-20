import { BaseModel, column } from '@adonisjs/lucid/orm'
import { decimal } from '#helpers/columns'

/** An add-on applied to every unit of its order item (snapshot). */
export default class OrderItemAddon extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare orderItemId: number

  @column()
  declare addonId: string | null

  @column()
  declare name: string

  @column(decimal)
  declare unitPrice: number
}
