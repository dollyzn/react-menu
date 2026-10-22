import type { LucidRow } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'

/**
 * One row of a bulk edit. The client sends the final values (already
 * computed from "+10%", "R$ 12,90"…) and the `updatedAt` it saw, so a
 * retry can't apply a change twice and a concurrent edit isn't overwritten.
 */
export type BulkChange = {
  id: string
  updatedAt: string
  price?: number
  isAvailable?: boolean
}

type Editable = LucidRow & {
  id: string
  updatedAt: DateTime
  price: number
  isAvailable: boolean
}

const alreadyApplied = (row: Editable, change: BulkChange) =>
  (change.price === undefined || row.price === change.price) &&
  (change.isAvailable === undefined || row.isAvailable === change.isAvailable)

/**
 * Applies the changes to rows the caller loaded and locked (FOR UPDATE)
 * in `trx`; saves go through the same transaction (another connection
 * would wait on those locks forever). All or nothing: if any row is gone or changed
 * since the client loaded it, nothing is saved and the 409 lists them. A
 * row that already has the requested values counts as done (a repeated
 * request succeeds).
 */
export async function applyBulkChanges(
  rows: Editable[],
  changes: BulkChange[],
  trx: TransactionClientContract
) {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const stale = changes
    .filter((change) => {
      const row = byId.get(change.id)
      if (!row) return true
      if (alreadyApplied(row, change)) return false
      return row.updatedAt.toMillis() !== DateTime.fromISO(change.updatedAt).toMillis()
    })
    .map((change) => change.id)

  if (stale.length) {
    throw new AppException(
      'Alguns itens mudaram desde que você abriu a edição. Revise e salve de novo.',
      409,
      'E_STALE_ROWS',
      { ids: stale }
    )
  }

  let updated = 0
  for (const change of changes) {
    const row = byId.get(change.id)!
    if (alreadyApplied(row, change)) continue
    if (change.price !== undefined) row.price = change.price
    if (change.isAvailable !== undefined) row.isAvailable = change.isAvailable
    await row.useTransaction(trx).save()
    updated++
  }
  return updated
}
