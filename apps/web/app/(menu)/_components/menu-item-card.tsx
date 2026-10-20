"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { ImageOff, Plus } from "lucide-react";
import type { PublicMenuItem } from "@react-menu/contracts";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

interface MenuItemCardProps {
  item: PublicMenuItem;
  onSelect: (item: PublicMenuItem) => void;
}

export function MenuItemCard({ item, onSelect }: MenuItemCardProps) {
  const disabled = !item.isAvailable;

  return (
    <motion.button
      type="button"
      layout
      whileTap={disabled ? undefined : { scale: 0.98 }}
      disabled={disabled}
      onClick={() => onSelect(item)}
      aria-label={`${item.name}, ${formatCurrencyBRL(item.price)}${disabled ? ", esgotado" : ""}`}
      className={cn(
        "group flex w-full gap-3 rounded-2xl border bg-card p-3 text-left transition-shadow outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        disabled ? "cursor-not-allowed opacity-60" : "hover:shadow-md"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-semibold leading-snug text-balance">{item.name}</h3>
        {item.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <span className="font-semibold text-primary">{formatCurrencyBRL(item.price)}</span>
          {disabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Esgotado
            </span>
          )}
        </div>
      </div>
      <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt=""
            fill
            sizes="96px"
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              disabled && "grayscale"
            )}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-6 opacity-50" />
          </span>
        )}
        {!disabled && (
          <span
            aria-hidden
            className="absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-110"
          >
            <Plus className="size-4" />
          </span>
        )}
      </div>
    </motion.button>
  );
}
