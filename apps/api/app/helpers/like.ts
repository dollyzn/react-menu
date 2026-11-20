/**
 * A LIKE/ILIKE pattern that finds `text` anywhere, with its own `%`, `_`
 * and `\` matching themselves (Postgres' default escape is the backslash).
 */
export function containing(text: string) {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}
