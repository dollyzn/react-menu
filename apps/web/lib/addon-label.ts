/**
 * How an add-on reads on a bag line, ticket or order: "Recheio extra: Carne"
 * for a choice group pick, just the name otherwise (the API's kitchen and
 * e-mails use the same format).
 */
export const addonLabel = (addon: { name: string; groupName?: string | null }) =>
  addon.groupName ? `${addon.groupName}: ${addon.name}` : addon.name;

/**
 * A line's add-ons as labels, repeats counted: a group pick chosen twice
 * reads "Escolha 2 sabores: 2× Queijo" (like the API's `addonLabels`).
 */
export function addonLabels(addons: { name: string; groupName?: string | null }[]) {
  const counts = new Map<string, { addon: (typeof addons)[number]; count: number }>();
  for (const addon of addons) {
    const key = `${addon.groupName ?? ""}\u0000${addon.name}`;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { addon, count: 1 });
  }
  return [...counts.values()].map(({ addon, count }) =>
    addonLabel(count > 1 ? { ...addon, name: `${count}× ${addon.name}` } : addon),
  );
}
