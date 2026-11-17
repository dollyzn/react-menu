"use client";

import type { RowData } from "@tanstack/react-table";
import { useEffect, useRef } from "react";
import { ArrowUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DataTableInstance } from ".";

/** How many more rows each step asks for. */
export const LOAD_MORE_STEP = 20;

/**
 * Phones: instead of pages, the list grows. Reaching its end loads the next
 * rows by itself (the button stays for whoever taps first, and for keyboards
 * and screen readers), a thin bar shows how much of the list is on screen,
 * and the end offers the way back to the top.
 *
 * It grows the page size on page 1, so the URL keeps it (a reload shows the
 * same rows) and server-side tables need nothing new. `maxPageSize` is what
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
  const capped = maxPageSize !== undefined && pageSize >= maxPageSize;
  // The bigger page is on its way: the rows already shown stay meanwhile.
  const fetching = shown < Math.min(pageSize, total);
  const more = shown > 0 && shown < total && !capped;

  // The size already asked for: until the table reaches it, the button and
  // reaching the end can't both add a step.
  const asked = useRef(0);
  const grow = () => {
    if (asked.current > pageSize) return;
    const next = Math.min(pageSize + LOAD_MORE_STEP, maxPageSize ?? Number.POSITIVE_INFINITY);
    asked.current = next;
    table.setPagination({ pageIndex: 0, pageSize: next });
  };
  const growRef = useRef(grow);
  useEffect(() => {
    growRef.current = grow;
  });

  // Reaching the end of the list loads more (a little before it shows).
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = end.current;
    if (!node || !more || fetching) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && growRef.current(), {
      rootMargin: "0px 0px 240px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [more, fetching]);

  if (total === 0 || shown === 0) return null;

  const backToTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });

  if (shown >= total) {
    return (
      <div className="flex flex-col items-center gap-1 pt-4 pb-6">
        <div aria-hidden className="mb-2 flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-muted-foreground/30" />
          <span className="size-1 rounded-full bg-muted-foreground/30" />
          <span className="size-1 rounded-full bg-muted-foreground/30" />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {total === 1 ? "1 resultado" : `Fim da lista · ${total} resultados`}
        </p>
        {total > LOAD_MORE_STEP && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={backToTop}>
            <ArrowUp /> Voltar ao topo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={end} className="flex flex-col items-center gap-3 pt-4 pb-6">
      <div className="flex w-full max-w-56 flex-col items-center gap-2">
        <div
          role="progressbar"
          aria-label="Quanto da lista está na tela"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={shown}
          className="h-1 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${Math.max(4, (shown / total) * 100)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          Mostrando {shown} de {total}
        </p>
      </div>

      {capped ? (
        <p className="max-w-72 text-center text-xs text-balance text-muted-foreground">
          Para ver os outros, use a busca, os filtros ou inverta a ordem.
        </p>
      ) : fetching ? (
        <p className="flex h-7 items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <Spinner className="size-3.5" aria-hidden /> Carregando mais…
        </p>
      ) : (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={grow}>
          <ChevronDown /> Carregar mais {Math.min(LOAD_MORE_STEP, total - shown)}
        </Button>
      )}
    </div>
  );
}
