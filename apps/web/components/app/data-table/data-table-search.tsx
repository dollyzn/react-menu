"use client";

import type { RowData } from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { Kbd } from "@/components/ui/kbd";
import { SearchInput } from "@/components/app/search-input";
import { cn } from "@/lib/utils";
import type { DataTableInstance } from ".";

/**
 * The table's searchable column as a field (desktop and phones): applies
 * after a pause or on Enter. With `shortcut`, "/" anywhere on the page
 * focuses it (shown inside the field while it is empty).
 */
export function DataTableSearch<TData extends RowData>({
  table,
  columnId,
  shortcut = false,
  className,
  wrapperClassName,
}: {
  table: DataTableInstance<TData>;
  columnId: string;
  shortcut?: boolean;
  className?: string;
  wrapperClassName?: string;
}) {
  const column = table.getColumn(columnId);
  const applied = (column?.getFilterValue() as string | undefined) ?? "";
  const [text, setText] = useState(applied);
  const [seen, setSeen] = useState(applied);
  // What this field applied itself: its own value coming back must not
  // replace what was typed since (a trailing space, the next letters).
  const [mine, setMine] = useState(applied);
  // Cleared or changed elsewhere ("Limpar filtros", a shared link): show it.
  if (applied !== seen) {
    setSeen(applied);
    if (applied !== mine) setText(applied);
  }

  const apply = (value: string) => {
    setMine(value.trim());
    table.getColumn(columnId)?.setFilterValue(value.trim() || undefined);
  };

  useEffect(() => {
    if (text.trim() === applied) return;
    const timer = setTimeout(() => apply(text), 400);
    return () => clearTimeout(timer);
    // `apply` reads the table, whose reference never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, applied]);

  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Not while typing somewhere, nor with a dialog open.
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const label = column?.columnDef.meta?.name ?? "Buscar";
  return (
    <div className={cn("relative", wrapperClassName)}>
      <SearchInput
        ref={input}
        value={text}
        onValueChange={setText}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
            apply(text);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={label}
        aria-label={`Buscar por ${label.toLowerCase()}`}
        aria-keyshortcuts={shortcut ? "/" : undefined}
        enterKeyHint="search"
        className={cn("text-ellipsis", shortcut && !text && "pr-9", className)}
      />
      {shortcut && !text && !focused && (
        <Kbd aria-hidden className="absolute inset-y-0 right-2 my-auto">
          /
        </Kbd>
      )}
    </div>
  );
}
