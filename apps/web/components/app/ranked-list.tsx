"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type RankedRow = {
  key: string;
  label: React.ReactNode;
  /** Bar length (relative to the largest row). */
  amount: number;
  /** Main figure at the end ("32 un", "45%"). */
  value: string;
  /** Secondary figure under it. */
  detail?: string;
};

/**
 * A ranked list with a thin bar per row: names and numbers are text (nothing
 * hides behind a hover), the bar only shows the proportion.
 */
export function RankedList({
  rows,
  limit = 8,
  bars = true,
  label,
  empty,
}: {
  rows: RankedRow[];
  limit?: number;
  /** false when the amounts aren't comparable (different units). */
  bars?: boolean;
  /** Names the list for screen readers. */
  label: string;
  empty: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((row) => row.amount), 1);
  const visible = expanded ? rows : rows.slice(0, limit);
  return (
    <div className="grid gap-1">
      <ol aria-label={label} className="grid gap-3">
        {visible.map((row, index) => (
          <li key={row.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{index + 1}</span>
            <span className="truncate text-sm font-medium">{row.label}</span>
            <span className="row-span-2 text-right">
              <span className="block text-sm font-semibold tabular-nums">{row.value}</span>
              {row.detail && <span className="block text-xs text-muted-foreground tabular-nums">{row.detail}</span>}
            </span>
            {bars && (
            <span className="col-start-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.max(2, (row.amount / max) * 100)}%` }}
              />
            </span>
            )}
          </li>
        ))}
      </ol>
      {rows.length > limit && (
        <Button variant="ghost" size="sm" className="mt-2 self-start" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Mostrar menos" : `Ver todos (${rows.length})`}
        </Button>
      )}
    </div>
  );
}
