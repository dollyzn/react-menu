"use client";

import { createContext, useContext, type CSSProperties } from "react";
import { TableCell } from "@/components/ui/table";

/** Where a pinned column sticks: its side, how far from that edge, and whether it draws the dividing line. */
export interface PinnedCell {
  side: "start" | "end";
  offset: number;
  /** The innermost pinned column of its side, while something scrolls under it. */
  line: boolean;
}

/** Set by the DataTable around each cell of a pinned column. */
export const PinnedCellContext = createContext<PinnedCell | null>(null);

const LINE = "var(--color-border)";

/** The sticky styles of a pinned cell; `extraShadow` keeps a header's bottom line. */
export function pinnedStyle(pin: PinnedCell | null, extraShadow?: string): CSSProperties | undefined {
  if (!pin) return undefined;
  const divider = pin.line ? `inset ${pin.side === "start" ? "-1px" : "1px"} 0 0 ${LINE}` : undefined;
  return {
    position: "sticky",
    [pin.side === "start" ? "left" : "right"]: pin.offset,
    zIndex: 1,
    boxShadow: [extraShadow, divider].filter(Boolean).join(", ") || undefined,
  };
}

export default function DataTableColumnCell({ style, ...props }: React.HTMLAttributes<HTMLTableCellElement>) {
  const pin = useContext(PinnedCellContext);
  return <TableCell {...props} style={pin ? { ...pinnedStyle(pin), ...style } : style} />;
}
