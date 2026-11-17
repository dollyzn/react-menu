"use client";

import type { RowData } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import type { DataTableInstance } from ".";

/** How many more rows each "Carregar mais" asks for. */
export const LOAD_MORE_STEP = 20;

/**
 * Phones: instead of pages, the list grows ("Carregar mais 20"). It grows
 * the page size on page 1, so the URL keeps it (a reload shows the same
 * rows) and the server-side tables need nothing new. `maxPageSize` is what
 * the API accepts; past it the list says how to reach the others.
 */
export function DataTableLoadMore<TData extends RowData>({
  table,
  maxPageSize,
}: {
  table: DataTableInstance<TData>;
  maxPageSize?: number;
}) {
  const total = table.getRowCount();
  const shown = table.getRowModel().rows.length;
  const { pageSize } = table.state.pagination;
  if (total === 0 || shown === 0) return null;

  if (shown >= total) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground tabular-nums">
        {total === 1 ? "1 resultado" : `Todos os ${total} resultados estão na tela`}
      </p>
    );
  }

  const capped = maxPageSize !== undefined && pageSize >= maxPageSize;
  // The bigger page is on its way: the rows already shown stay meanwhile.
  const fetching = shown < Math.min(pageSize, total);
  const next = Math.min(LOAD_MORE_STEP, total - shown);

  return (
    <div className="flex flex-col items-center gap-2 pt-2 pb-4">
      {capped ? (
        <p className="max-w-80 text-center text-sm text-balance text-muted-foreground">
          Para ver os outros, use a busca, os filtros ou inverta a ordem.
        </p>
      ) : (
        <Button
          variant="outline"
          size="lg"
          className="w-full max-w-xs"
          loading={fetching}
          onClick={() =>
            table.setPagination({
              pageIndex: 0,
              pageSize: Math.min(pageSize + LOAD_MORE_STEP, maxPageSize ?? Number.POSITIVE_INFINITY),
            })
          }
        >
          Carregar mais {next}
        </Button>
      )}
      <p className="text-xs text-muted-foreground tabular-nums">
        Mostrando {shown} de {total}
      </p>
    </div>
  );
}
