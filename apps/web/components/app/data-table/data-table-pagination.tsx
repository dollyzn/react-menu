import type { RowData } from "@tanstack/react-table";
import type { DataTableInstance } from ".";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  /** After a page change (the DataTable scrolls the list back to its top). */
  onPageChange?: () => void;
}

/**
 * "21–40 de 134", the pages by number (the first, the last and the ones
 * around the current, with "…" between) and how many per page.
 */
export function DataTablePagination<TData extends RowData>({
  table,
  onPageChange,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.state.pagination;
  const total = table.getRowCount();
  const pages = Math.max(table.getPageCount(), 1);
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);
  const sizes: number[] = env.NEXT_PUBLIC_PAGE_SIZES;

  const go = (index: number) => {
    table.setPageIndex(index);
    onPageChange?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-sm text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">
          {from}–{to}
        </span>{" "}
        de {total}
      </p>

      <nav aria-label="Páginas" className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ir para a página anterior"
          disabled={!table.getCanPreviousPage()}
          onClick={() => go(pageIndex - 1)}
        >
          <ChevronLeft />
        </Button>
        {pageList(pageIndex, pages).map((page, index) =>
          page === null ? (
            <span key={`gap-${index}`} aria-hidden className="w-6 text-center text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant={page === pageIndex ? "outline" : "ghost"}
              size="icon"
              aria-label={`Página ${page + 1}`}
              aria-current={page === pageIndex ? "page" : undefined}
              className={cn(
                "w-auto min-w-8 px-2 tabular-nums",
                page === pageIndex ? "font-semibold shadow-xs" : "text-muted-foreground"
              )}
              onClick={() => page !== pageIndex && go(page)}
            >
              {page + 1}
            </Button>
          )
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ir para a próxima página"
          disabled={!table.getCanNextPage()}
          onClick={() => go(pageIndex + 1)}
        >
          <ChevronRight />
        </Button>
      </nav>

      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground sm:inline">Por página</span>
        <Select
          items={sizes.map((size) => ({ value: String(size), label: String(size) }))}
          value={`${pageSize}`}
          onValueChange={(value) => {
            table.setPageSize(Number(value));
            onPageChange?.();
          }}
        >
          <SelectTrigger className="h-8 w-18 bg-background" aria-label="Linhas por página">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {sizes.map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Page indexes to show: all up to 7; else the first, the last and the
 * current's neighbours, with `null` for "…" only where it hides two or more
 * pages (a gap of one shows that page instead).
 */
export function pageList(current: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index);
  let start = Math.max(1, current - 1);
  let end = Math.min(pages - 2, current + 1);
  if (current <= 2) [start, end] = [1, 3];
  if (current >= pages - 3) [start, end] = [pages - 4, pages - 2];
  const shown = [0];
  for (let page = start; page <= end; page++) shown.push(page);
  shown.push(pages - 1);
  const list: (number | null)[] = [];
  shown.forEach((page, index) => {
    const previous = shown[index - 1];
    if (previous !== undefined && page - previous === 2) list.push(previous + 1);
    else if (previous !== undefined && page - previous > 2) list.push(null);
    list.push(page);
  });
  return list;
}
