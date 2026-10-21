"use client";

import { Check, ChevronsUpDown, ListFilter, Minus } from "lucide-react";
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
    <span className="ml-0.5 max-w-[180px] truncate rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
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
  option: Pick<FilterOption, "label" | "icon" | "iconClassName" | "quantity">;
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
      className="cursor-pointer gap-2.5 py-2 [&>svg:last-child]:hidden"
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
      <span className="flex-1 whitespace-nowrap">{option.label}</span>
      {option.quantity !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">{option.quantity}</span>
      )}
    </CommandItem>
  );
}
