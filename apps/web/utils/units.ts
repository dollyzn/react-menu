import type { IngredientUnit } from "@react-menu/contracts";

const number = (value: number, digits = 1) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: digits });

/** "1500 g" → "1,5 kg", "2 un" → "2 un"; readable at a glance in the kitchen. */
export function formatQuantity(quantity: number, unit: IngredientUnit): string {
  if (unit === "g" && Math.abs(quantity) >= 1000) return `${number(quantity / 1000, 2)} kg`;
  if (unit === "ml" && Math.abs(quantity) >= 1000) return `${number(quantity / 1000, 2)} l`;
  return `${number(quantity, unit === "un" ? 0 : 1)} ${unit}`;
}

export const unitLabels: Record<IngredientUnit, string> = {
  g: "gramas (g)",
  kg: "quilos (kg)",
  ml: "mililitros (ml)",
  l: "litros (l)",
  un: "unidades (un)",
};
