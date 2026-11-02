import { BaseModel, column } from '@adonisjs/lucid/orm'
import { decimal } from '#helpers/columns'

/** How a line's add-on reads on tickets and in the kitchen: "Recheio extra: Carne". */
export function addonLabel(addon: { name: string; groupName: string | null }) {
  return addon.groupName ? `${addon.groupName}: ${addon.name}` : addon.name
}

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

  /** The choice group it was picked in ("Recheio extra"); null for a plain add-on. */
  @column()
  declare groupName: string | null

  @column(decimal)
  declare unitPrice: number
}
