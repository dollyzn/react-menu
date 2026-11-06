import { formatCurrencyBRL } from "@/utils/string";

type Priced = { pickPrices: number[] | null };

/**
 * What the nth pick (0-based, in the order chosen) costs in a group priced by
 * pick order, or null when the options carry their own price. Mirrors the
 * API (`pickPrice` in models/option_group.ts): the last price repeats.
 */
export function pickPrice(group: Priced, index: number) {
  const prices = group.pickPrices;
  if (!prices?.length) return null;
  return prices[Math.min(index, prices.length - 1)]!;
}

/** The group's picks in the order chosen, each with what it costs there. */
export function pricedPicks<Option extends { id: string; price: number }>(
  group: Priced & { options: Option[] },
  picked: string[],
) {
  return picked.flatMap((id, index) => {
    const option = group.options.find((candidate) => candidate.id === id);
    return option ? [{ ...option, price: pickPrice(group, index) ?? option.price }] : [];
  });
}

/**
 * Re-prices a line's picks of groups priced by pick order (the API does the
 * same at checkout), in the order they're listed.
 */
export function repriceByPick<Addon extends { groupId?: string; price: number }>(
  addons: Addon[],
  groups: (Priced & { id: string })[],
) {
  const seen = new Map<string, number>();
  return addons.map((addon) => {
    const group = addon.groupId ? groups.find((candidate) => candidate.id === addon.groupId) : undefined;
    if (!group?.pickPrices?.length) return addon;
    const index = seen.get(group.id) ?? 0;
    seen.set(group.id, index + 1);
    return { ...addon, price: pickPrice(group, index)! };
  });
}

const ordinal = (index: number) => `${index + 1}º`;

/** "1º + R$ 3,00 · a partir do 2º + R$ 5,00" (the rule shown under the group). */
export function pickPricesLabel(prices: number[], maxChoices: number) {
  const price = (value: number) => (value ? `+ ${formatCurrencyBRL(value)}` : "grátis");
  const shown = prices.slice(0, maxChoices);
  // [3, 5, 5] reads "1º … · a partir do 2º …".
  while (shown.length > 1 && shown.at(-1) === shown.at(-2)) shown.pop();
  if (shown.every((value) => value === shown[0])) return `${price(shown[0]!)} cada`;
  return shown
    .map((value, index) =>
      index === shown.length - 1 && shown.length < maxChoices
        ? `a partir do ${ordinal(index)} ${price(value)}`
        : `${ordinal(index)} ${price(value)}`,
    )
    .join(" · ");
}
