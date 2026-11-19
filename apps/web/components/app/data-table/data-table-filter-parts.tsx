"use client";

import { Check, ChevronsUpDown, ListFilter, Minus } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CommandItem } from "@/components/ui/command";
import { PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FilterGroup, FilterOption } from ".";

/** Options with search only when there are enough to need it. */
export const SEARCH_THRESHOLD = 8;

export const flattenOptions = (options: FilterOption[] | FilterGroup[] | undefined, grouped?: boolean) =>
  (grouped ? (options as FilterGroup[] | undefined)?.flatMap((group) => group.options) : (options as FilterOption[] | undefined)) ??
  [];

/** Shared look of every filter button: dashed when idle, tinted when active. */
export const filterTriggerClassName = (active: boolean) =>
  cn("h-8 gap-1.5", active ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-dashed");

/** What the filter is set to, next to its name. */
export function FilterSummary({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-0.5 max-w-45 truncate rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
      {children}
    </span>
  );
}

/** The filter button: dashed when idle, tinted when it filters something. */
export function FilterTrigger({
  label,
  active,
  loading,
  summary,
}: {
  label: string;
  active: boolean;
  loading?: boolean;
  /** What is selected (shown when active). */
  summary?: React.ReactNode;
}) {
  return (
    <PopoverTrigger
      render={
        <Button
          variant="outline"
          size="sm"
          className={filterTriggerClassName(active)}
          aria-label={`Filtrar por ${label.toLowerCase()}`}
          loading={loading}
        />
      }
    >
      {!loading && <ListFilter className={cn(active && "text-primary")} />}
      <span className="first-letter:uppercase">{label}</span>
      {active && summary && <FilterSummary>{summary}</FilterSummary>}
      <ChevronsUpDown className="opacity-50" />
    </PopoverTrigger>
  );
}

/**
 * A toolbar selector (density, columns, card sorting): the same button as a
 * filter, but solid; tinted with a summary when it differs from the default.
 */
export function ToolbarTrigger({
  icon: Icon,
  label,
  summary,
  active = false,
  ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Shown next to the label (the current choice). */
  summary?: React.ReactNode;
  active?: boolean;
  ariaLabel?: string;
}) {
  return (
    <PopoverTrigger
      render={
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5", active && "border-primary/40 bg-primary/5 hover:bg-primary/10")}
          aria-label={ariaLabel}
        />
      }
    >
      <Icon className={cn(active && "text-primary")} />
      <span>{label}</span>
      {summary && <FilterSummary>{summary}</FilterSummary>}
      <ChevronsUpDown className="opacity-50" />
    </PopoverTrigger>
  );
}

/**
 * An option's count: fades in when it first arrives, dims while it is being
 * recounted (other filters picked) and then rolls to the new number, instead
 * of blinking out and back.
 */
export function FacetCount({ value, stale = false, className }: { value: number; stale?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const shown = useMotionValue(value);
  const text = useTransform(shown, (current) => String(Math.round(current)));
  useEffect(() => {
    if (reduce) {
      shown.set(value);
      return;
    }
    const controls = animate(shown, value, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [shown, value, reduce]);
  return (
    <motion.span
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: stale ? 0.45 : 1 }}
      transition={{ duration: 0.2 }}
      className={cn("text-xs text-muted-foreground tabular-nums", className)}
    >
      {text}
    </motion.span>
  );
}

/** A popover's title: what it filters or sets, above its search and options. */
export function PopoverHeading({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5 pb-1">
      <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">{children}</p>
      {hint && <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>}
    </div>
  );
}

/**
 * One option: the check on the left (square for multiple choice, round for a
 * single choice), the label without wrapping and the count on the right.
 * The theme's own trailing check is hidden: it pushed everything around.
 */
export function FilterOptionRow({
  option,
  selected,
  multiple,
  indeterminate,
  value,
  onSelect,
}: {
  option: Pick<FilterOption, "label" | "icon" | "iconClassName" | "quantity" | "quantityStale"> & {
    /** A second line under the label. */
    description?: string;
  };
  selected: boolean;
  multiple: boolean;
  indeterminate?: boolean;
  value: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      data-checked={selected}
      className={cn(
        "cursor-pointer gap-2.5 py-1.5 transition-colors [&>svg:last-child]:hidden",
        // No rows behind it (with the other filters as they are): quieter.
        option.quantity === 0 && !selected && "text-muted-foreground"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-4 shrink-0 items-center justify-center border transition-colors",
          multiple ? "rounded-[4px]" : "rounded-full",
          selected || indeterminate
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40"
        )}
      >
        {indeterminate ? (
          <Minus className="size-3" />
        ) : selected ? (
          multiple ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-primary-foreground" />
        ) : null}
      </span>
      {option.icon && <option.icon className={cn("size-4 text-muted-foreground", option.iconClassName)} />}
      {option.description ? (
        <span className="grid flex-1 gap-0.5">
          <span className="whitespace-nowrap">{option.label}</span>
          <span className="text-xs text-muted-foreground">{option.description}</span>
        </span>
      ) : (
        <span className="flex-1 whitespace-nowrap">{option.label}</span>
      )}
      {option.quantity !== undefined && <FacetCount value={option.quantity} stale={option.quantityStale} />}
    </CommandItem>
  );
}
