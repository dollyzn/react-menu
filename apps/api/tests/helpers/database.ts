import db from '@adonisjs/lucid/services/db'

let tables: string[] | undefined

/** The tables of the app, each after the ones that reference it. */
async function tablesChildrenFirst() {
  const all = await db.connection().getAllTables(['public'])
  const names = all.filter((table) => !table.startsWith('adonis_schema'))
  const { rows } = await db.rawQuery<{ rows: { child: string; parent: string }[] }>(`
    SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent
    FROM pg_constraint
    WHERE contype = 'f' AND conrelid <> confrelid AND connamespace = 'public'::regnamespace
  `)
  const ordered: string[] = []
  const visiting = new Set<string>()
  const visit = (table: string) => {
    if (ordered.includes(table)) return
    if (visiting.has(table)) throw new Error(`Foreign keys form a cycle through ${table}`)
    visiting.add(table)
    for (const { child, parent } of rows) if (parent === table) visit(child)
    visiting.delete(table)
    ordered.push(table)
  }
  for (const table of names) visit(table)
  return ordered.filter((table) => names.includes(table))
}

/**
 * Empties the tables a test wrote to, after it: one query finds them, one
 * round trip deletes their rows, children first (DELETE on these small
 * tables is several times faster than TRUNCATE). Not a global transaction:
 * the app runs independent queries at the same time (`Promise.all`, the
 * assistant's tool calls), each on its own pool connection; on the one
 * connection of a transaction pg queues them, and pg 9 refuses that.
 */
export async function emptyDatabase() {
  tables ??= await tablesChildrenFirst()
  if (tables.length === 0) return
  const { rows } = await db.rawQuery<{ rows: { name: string }[] }>(
    tables
      .map((table) => `SELECT '${table}' AS name WHERE EXISTS (SELECT 1 FROM "${table}")`)
      .join(' UNION ALL ')
  )
  const filled = new Set(rows.map(({ name }) => name))
  const deletes = tables.filter((table) => filled.has(table))
  if (deletes.length === 0) return
  await db.rawQuery(deletes.map((table) => `DELETE FROM "${table}";`).join(' '))
}
