"use client";

import Image from "@/components/app/image";
import { AnimatePresence, motion } from "motion/react";
import { Plus, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import type { PublicMenuItem } from "@react-menu/contracts";
import { stockHint } from "@/lib/stock";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

/** Per-category color (identity, not status: raw palette on purpose): a dot on the section header and the cards' left edge. */
export const CATEGORY_ACCENTS = [
  { dot: "bg-orange-500", border: "border-l-orange-500" },
  { dot: "bg-sky-500", border: "border-l-sky-500" },
  { dot: "bg-emerald-500", border: "border-l-emerald-500" },
  { dot: "bg-violet-500", border: "border-l-violet-500" },
  { dot: "bg-rose-500", border: "border-l-rose-500" },
  { dot: "bg-amber-500", border: "border-l-amber-500" },
  { dot: "bg-teal-500", border: "border-l-teal-500" },
  { dot: "bg-fuchsia-500", border: "border-l-fuchsia-500" },
];

/** A product on the POS grid (the store's and the partner's): a tap adds it. */
export function ProductCard({
  item,
  quantity,
  left,
  accent,
  onAdd,
  eager,
}: {
  item: PublicMenuItem;
  quantity: number;
  /** Units the stock still allows after the ticket (null = no limit). */
  left: number | null;
  /** Category color for the left edge. */
  accent: string;
  onAdd: () => void;
  /** Above the fold: load the photo right away. */
  eager?: boolean;
}) {
  const price = item.isAvailable ? formatCurrencyBRL(item.price) : "Esgotado";
  const canAdd = item.isAvailable && left !== 0;
  const hint = item.isAvailable ? stockHint(left) : null;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      disabled={!canAdd}
      onClick={onAdd}
      aria-label={`${item.name} ${price}${quantity ? `, ${quantity} na comanda` : ""}${hint ? `, ${hint.toLowerCase()}` : ""}`}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-l-4 bg-card p-2 pr-3 text-left transition-all outline-none hover:border-primary/50 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50",
        accent,
        quantity > 0 && "border-primary bg-primary/5",
        !canAdd && "cursor-not-allowed opacity-50"
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            blurDataURL={item.photoBlur}
            alt=""
            fill
            sizes="56px"
            loading={eager ? "eager" : undefined}
            className="object-cover"
          />
        ) : (
          <UtensilsCrossed className="absolute top-1/2 left-1/2 size-5 -translate-1/2 text-muted-foreground/50" />
        )}
        <AnimatePresence>
          {quantity > 0 && (
            <motion.span
              key={quantity}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-primary/80 text-lg font-bold text-primary-foreground tabular-nums"
            >
              {quantity}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-sm leading-tight font-medium">{item.name}</span>
        {/* Wraps instead of squeezing: on a narrow card the stock badge goes below. */}
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="shrink-0 font-semibold whitespace-nowrap text-primary">{price}</span>
          {(item.addons.length > 0 || item.optionGroups.length > 0) && (
            <SlidersHorizontal aria-hidden className="size-3.5 shrink-0 text-muted-foreground">
              <title>Tem adicionais</title>
            </SlidersHorizontal>
          )}
          {hint && (
            <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] leading-tight font-medium whitespace-nowrap text-warning">
              {hint}
            </span>
          )}
        </span>
      </div>
      {canAdd && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Plus className="size-4" />
        </span>
      )}
    </motion.button>
  );
}
