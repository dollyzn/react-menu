/** A pick of a choice group, with the word of the item's name it replaces (if any). */
export type RenamingPick = { name: string; replaces: string | null }

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "Catupiry", "Catupiry e Cheddar", "Catupiry, Cheddar e Mussarela". */
function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : names[0]
}

/**
 * The item's name on the staff screens: each choice group with a
 * `replacesInName` word puts its picks in that word's place ("Pastel de
 * Frango com Queijo" + Catupiry = "Pastel de Frango com Catupiry"). Whole
 * words only, ignoring case. Null when nothing changes (no such group, or
 * the word isn't in the name).
 */
export function displayName(itemName: string, picks: RenamingPick[]): string | null {
  const byWord = new Map<string, { word: string; names: string[] }>()
  for (const pick of picks) {
    const word = pick.replaces?.trim()
    if (!word) continue
    const entry = byWord.get(word.toLowerCase()) ?? { word, names: [] }
    if (!entry.names.includes(pick.name)) entry.names.push(pick.name)
    byWord.set(word.toLowerCase(), entry)
  }

  let name = itemName
  for (const { word, names } of byWord.values()) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'iu')
    name = name.replace(pattern, () => joinNames(names))
  }
  return name === itemName ? null : name
}
