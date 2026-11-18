import type { CardFees } from "@react-menu/contracts";

export type CardType = keyof CardFees;

/**
 * The card fee on `amount` at `percent`, to the cent. Mirrors the API
 * (`#payments/card_fee`), which charges it and refuses a total that differs.
 */
export function cardFee(amount: number, percent: number) {
  return Math.round((Math.round(amount * 100) * percent) / 100) / 100;
}

/** `amount` plus the fee, to the cent. */
export const withCardFee = (amount: number, percent: number) =>
  Math.round((amount + cardFee(amount, percent)) * 100) / 100;

/** 4.99 → "4,99%", 2 → "2%". */
export const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
