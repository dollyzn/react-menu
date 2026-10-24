"use client";

import type { Ingredient } from "@react-menu/contracts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/utils/units";
import { IngredientMenu, StockMoves } from "./ingredient-actions";

export function LowStockBadge() {
  return (
    <Badge variant="outline" className="border-warning/50 text-warning">
      Acabando
    </Badge>
  );
}

/** Card view (default): stock at a glance plus the everyday moves. */
export function IngredientCard({ ingredient }: { ingredient: Ingredient }) {
  return (
    <article
      aria-label={ingredient.name}
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border bg-card p-4",
        ingredient.isLowStock && "border-warning/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted font-emoji text-2xl">
          {ingredient.icon ?? "•"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{ingredient.name}</p>
          <p className="text-xs text-muted-foreground">Mínimo {formatQuantity(ingredient.minStock, ingredient.unit)}</p>
        </div>
        <IngredientMenu ingredient={ingredient} />
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold tabular-nums">
          {formatQuantity(ingredient.stockQuantity, ingredient.unit)}
        </span>
        {ingredient.isLowStock && <LowStockBadge />}
      </div>
      <StockMoves ingredient={ingredient} className="mt-auto grid grid-cols-3" />
    </article>
  );
}
