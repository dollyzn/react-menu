import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

/** Filtro vindo da query: um valor ou vários (?campo=a&campo=b). */
export type MultiString = string | string[]

function expandStrings(value: MultiString | undefined): string[] {
  if (value === undefined) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr.map((s) => s.trim()).filter((s) => s.length > 0)
}

/** Um termo: `ILIKE %termo%` (sem diferenciar maiúsculas). Vários: OR no mesmo campo. */
export function whereLikeAnyColumn<Model extends LucidModel>(
  query: ModelQueryBuilderContract<Model>,
  column: string,
  value: MultiString | undefined
) {
  const terms = expandStrings(value)
  if (terms.length === 0) return
  if (terms.length === 1) {
    query.whereILike(column, `%${terms[0]}%`)
    return
  }
  query.where((b) => {
    b.whereILike(column, `%${terms[0]}%`)
    for (let i = 1; i < terms.length; i++) {
      b.orWhereILike(column, `%${terms[i]}%`)
    }
  })
}

/** Um valor: `where col = v`. Vários: `whereIn(col, vals)`. */
export function whereEqOrInColumn<Model extends LucidModel>(
  query: ModelQueryBuilderContract<Model>,
  column: string,
  value: MultiString | undefined
) {
  const vals = expandStrings(value)
  if (vals.length === 0) return
  if (vals.length === 1) {
    query.where(column, vals[0])
    return
  }
  query.whereIn(column, vals)
}
