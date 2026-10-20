import type { LucidRow } from '@adonisjs/lucid/types/model'

export type BulkDeleteResult<T> = {
  deleted: T[]
  failed: T[]
}

/**
 * Deletes rows one by one so a single failure (e.g. a FK constraint)
 * doesn't abort the others. Callers must scope `rows` to the store.
 */
export async function deleteEach<T extends LucidRow>(rows: T[]): Promise<BulkDeleteResult<T>> {
  const deleted: T[] = []
  const failed: T[] = []

  for (const row of rows) {
    try {
      await row.delete()
      deleted.push(row)
    } catch {
      failed.push(row)
    }
  }

  return { deleted, failed }
}
