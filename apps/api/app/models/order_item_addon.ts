import { BaseModel, column } from '@adonisjs/lucid/orm'
import { decimal } from '#helpers/columns'

/** How a line's add-on reads on tickets and in the kitchen: "Recheio extra: Carne". */
export function addonLabel(addon: { name: string; groupName: string | null }) {
  return addon.groupName ? `${addon.groupName}: ${addon.name}` : addon.name
}

/**
 * A line's add-ons as labels, repeats counted: a group pick chosen twice
 * reads "Escolha 2 sabores: 2× Queijo", in the order they were saved.
 */
export function addonLabels(addons: { name: string; groupName: string | null }[]) {
  const counts = new Map<string, { addon: (typeof addons)[number]; count: number }>()
  for (const addon of addons) {
    const key = `${addon.groupName ?? ''}\u0000${addon.name}`
    const entry = counts.get(key)
    if (entry) entry.count++
    else counts.set(key, { addon, count: 1 })
  }
  return [...counts.values()].map(({ addon, count }) =>
    // Explicit fields: a model's columns are getters, lost in a spread.
    count > 1
      ? addonLabel({ name: `${count}× ${addon.name}`, groupName: addon.groupName })
      : addonLabel(addon)
  )
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
