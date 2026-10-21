/**
 * Valores típicos de `request.qs()` no Adonis (query string repetida vira array).
 */
export type QueryStringRecord = Record<string, string | string[] | undefined>

function firstString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first : undefined
  }
  return typeof value === 'string' ? value : undefined
}

function allNonEmptyStrings(value: string | string[] | undefined): string[] {
  if (value === undefined) return []
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  const s = value.trim()
  return s.length > 0 ? [s] : []
}

/**
 * Inteiro >= 1 para page / perPage. Ignora NaN, zero e negativos.
 */
export function parsePositiveInt(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value)
  if (raw === undefined) return undefined
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return undefined
  return n
}

export function parsePagination(q: QueryStringRecord) {
  return {
    page: parsePositiveInt(q.page),
    perPage: parsePositiveInt(q.perPage),
  }
}

/**
 * Extrai filtros string: um valor vira `string`, vários na mesma chave viram `string[]`
 * (`?status=a&status=b` ou `?status=a` após trim).
 */
export function pickQueryFilters<K extends string>(
  q: QueryStringRecord,
  keys: readonly K[]
): Partial<Record<K, string | string[]>> {
  const out: Partial<Record<K, string | string[]>> = {}
  for (const key of keys) {
    const vals = allNonEmptyStrings(q[key])
    if (vals.length === 0) continue
    out[key] = vals.length === 1 ? vals[0]! : vals
  }
  return out
}

function allPositiveInts(value: string | string[] | undefined): number[] {
  const strings = allNonEmptyStrings(value)
  const nums: number[] = []
  for (const s of strings) {
    const n = Number.parseInt(s, 10)
    if (Number.isFinite(n) && n >= 1) nums.push(n)
  }
  return nums
}

/**
 * Inteiros >= 1 por chave: um valor → `number`, vários → `number[]`.
 */
export function pickQueryPositiveInts<K extends string>(
  q: QueryStringRecord,
  keys: readonly K[]
): Partial<Record<K, number | number[]>> {
  const out: Partial<Record<K, number | number[]>> = {}
  for (const key of keys) {
    const vals = allPositiveInts(q[key])
    if (vals.length === 0) continue
    out[key] = vals.length === 1 ? vals[0]! : vals
  }
  return out
}

export type SortSpec = { column: string; direction: 'asc' | 'desc' }[]

/**
 * `sort=name:asc&sort=price:desc` (the data-table format). Only ids in
 * `allowed` are used, mapped to their database column; anything else is
 * ignored, so the URL can never order by an arbitrary column.
 */
export function parseSort(q: QueryStringRecord, allowed: Record<string, string>): SortSpec {
  return allNonEmptyStrings(q.sort).flatMap((entry) => {
    const [id, direction] = entry.split(':')
    const column = allowed[id ?? '']
    if (!column || (direction !== 'asc' && direction !== 'desc')) return []
    return [{ column, direction }]
  })
}
