/** From this many units left, the menu and the POS warn that it's running out. */
export const LOW_STOCK = 5;

/** Units still free after what the bag/ticket already holds; null = no limit. */
export function unitsLeft(stockLeft: number | null, alreadyChosen = 0) {
  return stockLeft === null ? null : Math.max(0, stockLeft - alreadyChosen);
}

/** "Restam 3", "Última unidade"… or null when there's plenty (or no limit). */
export function stockHint(left: number | null) {
  if (left === null || left > LOW_STOCK) return null;
  if (left === 0) return "Sem mais no estoque";
  return left === 1 ? "Última unidade" : `Restam ${left}`;
}
