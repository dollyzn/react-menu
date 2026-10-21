/**
 * Kitchen production queue.
 *
 * The cook always works on the oldest pending unit, but identical units from
 * the next few orders are pulled into the same batch, so "carne, queijo,
 * carne" becomes "2× carne, then 1× queijo". The look-ahead is bounded by
 * `lookahead` orders (per store, `stores.kitchen_batch_lookahead`), so no
 * order is ever overtaken by more than that many later orders. 0 keeps
 * strict arrival order: only units of the same order are grouped.
 */

export type PendingUnit = {
  orderId: string
  orderNumber: number
  /** Position of the order in arrival order (0 = oldest). */
  orderIndex: number
  lineId: number
  itemId: string | null
  name: string
  addons: string[]
  notes: string | null
  /** Units of this line still to be made. */
  remaining: number
}

export type ProductionBatch = {
  /** Identical units share a key: same item and add-ons, and no notes. */
  key: string
  name: string
  addons: string[]
  notes: string | null
  quantity: number
  /** Where each unit goes, oldest order first. */
  units: { orderId: string; orderNumber: number; lineId: number; quantity: number }[]
}

export const DEFAULT_LOOKAHEAD = 3
export const MAX_KITCHEN_LOOKAHEAD = 5

export function unitKey(
  unit: Pick<PendingUnit, 'itemId' | 'name' | 'addons' | 'notes' | 'lineId'>
) {
  // A line with notes ("sem cebola") is never mixed with others.
  if (unit.notes) return `line:${unit.lineId}`
  return `item:${unit.itemId ?? unit.name}|${[...unit.addons].sort().join(',')}`
}

/**
 * @param pending lines with remaining units, in order arrival order
 *   (orderIndex ascending, then line order).
 */
export function buildProductionQueue(
  pending: PendingUnit[],
  lookahead = DEFAULT_LOOKAHEAD
): ProductionBatch[] {
  const queue = pending.filter((unit) => unit.remaining > 0).map((unit) => ({ ...unit }))
  const batches: ProductionBatch[] = []

  while (queue.length > 0) {
    const head = queue[0]
    const key = unitKey(head)
    const maxOrderIndex = head.orderIndex + lookahead

    const members = queue.filter(
      (unit) => unitKey(unit) === key && unit.orderIndex <= maxOrderIndex
    )

    batches.push({
      key,
      name: head.name,
      addons: head.addons,
      notes: head.notes,
      quantity: members.reduce((sum, unit) => sum + unit.remaining, 0),
      units: members.map((unit) => ({
        orderId: unit.orderId,
        orderNumber: unit.orderNumber,
        lineId: unit.lineId,
        quantity: unit.remaining,
      })),
    })

    for (const member of members) {
      queue.splice(queue.indexOf(member), 1)
    }
  }

  return batches
}
