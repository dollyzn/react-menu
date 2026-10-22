import type { BulkUpdateChange } from "@react-menu/contracts";

/** How the bulk edit changes prices. */
export type PriceRule =
  | { mode: "keep" }
  | { mode: "set"; value: number }
  | {
      mode: "increase" | "decrease";
      unit: "percent" | "amount";
      value: number;
      rounding: Rounding;
    };

/**
 * "90": price ending in ,90 · "050": multiple of R$ 0,50. Increases round
 * up and decreases round down, so "+10%" never lands below the raw value.
 */
export type Rounding = "none" | "90" | "050";

export type Availability = "keep" | "available" | "unavailable";

/** What a row needs for the bulk edit (items and add-ons). */
export type BulkEditable = {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
  updatedAt: string;
};

export const MAX_PRICE = 99999.99;

const cents = (value: number) => Math.round(value * 100) / 100;

function round(value: number, rounding: Rounding, direction: "up" | "down") {
  const exact = cents(value);
  if (rounding === "050") {
    const halves = direction === "up" ? Math.ceil(exact * 2 - 1e-9) : Math.floor(exact * 2 + 1e-9);
    return cents(halves / 2);
  }
  if (rounding === "90") {
    const ninety = Math.floor(exact) + 0.9;
    if (direction === "up") return cents(exact <= ninety + 1e-9 ? ninety : ninety + 1);
    return cents(exact >= ninety - 1e-9 ? ninety : ninety - 1);
  }
  return exact;
}

export function applyPriceRule(price: number, rule: PriceRule): number {
  switch (rule.mode) {
    case "keep":
      return price;
    case "set":
      return cents(rule.value);
    case "increase":
    case "decrease": {
      const sign = rule.mode === "increase" ? 1 : -1;
      const delta = rule.unit === "percent" ? (price * rule.value) / 100 : rule.value;
      return round(price + sign * delta, rule.rounding, sign > 0 ? "up" : "down");
    }
  }
}

export const isValidPrice = (price: number) => price > 0 && price <= MAX_PRICE;

export type PreviewRow = BulkEditable & {
  newPrice: number;
  newAvailable: boolean;
  changed: boolean;
  invalid: boolean;
};

export function preview(rows: BulkEditable[], rule: PriceRule, availability: Availability): PreviewRow[] {
  return rows.map((row) => {
    const newPrice = applyPriceRule(row.price, rule);
    const newAvailable = availability === "keep" ? row.isAvailable : availability === "available";
    return {
      ...row,
      newPrice,
      newAvailable,
      changed: newPrice !== row.price || newAvailable !== row.isAvailable,
      invalid: !isValidPrice(newPrice),
    };
  });
}

/**
 * Final values per row, only for what changes. Absolute values (not "+10%")
 * keep a retry from applying the change twice.
 */
export function toChanges(rows: PreviewRow[]): BulkUpdateChange[] {
  return rows
    .filter((row) => row.changed)
    .map((row) => ({
      id: row.id,
      updatedAt: row.updatedAt,
      ...(row.newPrice !== row.price ? { price: row.newPrice } : {}),
      ...(row.newAvailable !== row.isAvailable ? { isAvailable: row.newAvailable } : {}),
    }));
}
