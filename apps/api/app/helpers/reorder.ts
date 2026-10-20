import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'

/**
 * Renumbers `order` (1..N) for every row in `scope`, following `ids`.
 * `ids` must list each row of the scope exactly once, so a stale client
 * can't silently drop or duplicate positions.
 */
export async function applyOrder<Model extends LucidModel>(
  scope: ModelQueryBuilderContract<Model>,
  ids: (string | number)[],
  trx: TransactionClientContract
) {
  const rows = await scope.useTransaction(trx).select('id').forUpdate()
  const current = new Set(rows.map((row) => String(row.$primaryKeyValue)))
  const requested = ids.map(String)

  const isSamePermutation =
    requested.length === current.size &&
    new Set(requested).size === requested.length &&
    requested.every((id) => current.has(id))

  if (!isSamePermutation) {
    throw new AppException(
      'A lista de ordenação está desatualizada. Recarregue a página e tente novamente.',
      422,
      'E_STALE_ORDER'
    )
  }

  const model = scope.model
  for (const [index, id] of ids.entries()) {
    await model
      .query({ client: trx })
      .where('id', id)
      .update({ order: index + 1 })
  }
}
