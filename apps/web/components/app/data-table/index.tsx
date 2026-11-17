import { useCallback, useEffect, useRef, useState } from "react";
import { flexRender, useTable, type ReactTable, type RowData } from "@tanstack/react-table";
import {
  dataTableFeatures,
  type ColumnDef,
  type ColumnFiltersState,
  type DataTableFeatures,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "./features";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";
import { PinnedCellContext, pinnedStyle, type PinnedCell } from "./data-table-column-cell";
import { DataTableToolbar } from "./data-table-toolbar";
import { DataTableMobileToolbar } from "./data-table-mobile-toolbar";
import { DataTableLoadMore } from "./data-table-load-more";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useHydrated } from "@/hooks/use-hydrated";
import { Inbox, Search } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalStorage } from "usehooks-ts";
import { env } from "@/lib/env";

/** The line under the header, which a pinned header's own shadow must keep. */
const HEADER_LINE = "inset 0 -1px 0 var(--color-border)";

export interface FilterOption {
  label: string;
  value: string;
  quantity?: number;
  defaultOption?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
}

export interface FilterGroup {
  group: string;
  options: FilterOption[];
}

export interface ColumnsConfig {
  key: string;
  type?: "select" | "date-range";
  title?: string;
  searchable?: boolean;
  loading?: boolean;
  filterOptions?: FilterOption[] | FilterGroup[];
  grouped?: boolean;
}

export type DensityOption =
  | "comfortable"
  | "default"
  | "compact"
  | "spacious"
  | "ultra-compact";

export type ViewMode = "table" | "cards";

/** The table the DataTable builds: its `state` is reactive (Table v9). */
export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>;

interface DefaultVisibility {
  [breakpoint: number]: VisibilityState;
}

interface DataTableProps<TData extends RowData> {
  tableId: string;
  data: TData[];
  /** `ColumnDef<TData>`: v9 generics are invariant, so mixed value types are `unknown`. */
  columns: ColumnDef<TData>[];
  columnsConfig?: ColumnsConfig[];
  loading?: boolean;
  getRowId?: (row: TData) => string;
  wrapperClassName?: string;
  className?: string;
  tableHeaderClassName?: string;
  rowCount?: number;
  onRowClick?: (row: Row<TData>) => void;
  defaultDensity?: DensityOption;
  renderCard?: (row: Row<TData>) => React.ReactNode;
  defaultViewMode?: ViewMode;
  defaultCardsOnMobile?: boolean;
  cardsContainerClassName?: string;
  defaultVisibility?: DefaultVisibility;
  externalSorting?: SortingState;
  externalColumnFilters?: ColumnFiltersState;
  externalPagination?: PaginationState;
  externalRowSelection?: RowSelectionState;
  onExternalSortingChange?: React.Dispatch<React.SetStateAction<SortingState>>;
  onExternalColumnFiltersChange?: React.Dispatch<
    React.SetStateAction<ColumnFiltersState>
  >;
  onExternalPaginationChange?: React.Dispatch<
    React.SetStateAction<PaginationState>
  >;
  onExternalRowSelectionChange?: React.Dispatch<
    React.SetStateAction<RowSelectionState>
  >;
  /** The most rows the API returns at once: phones stop "Carregar mais" there. */
  maxPageSize?: number;
  /**
   * Columns that stay while the rest scrolls sideways, by id: `start` on the
   * left, `end` on the right (any number; their real widths set the offsets).
   * Default: the first visible column and the last. `{}` pins none.
   */
  pinnedColumns?: { start?: string[]; end?: string[] };
  /**
   * A request is in flight (server-side tables: `useTableQuery`'s `loading`).
   * Phones tell a slow "Carregar mais" from a failed one by it.
   */
  fetching?: boolean;
}

export function DataTable<TData extends RowData>({
  tableId,
  data,
  columns,
  columnsConfig,
  loading,
  getRowId,
  wrapperClassName,
  className,
  tableHeaderClassName,
  rowCount,
  onRowClick,
  defaultDensity,
  renderCard,
  defaultViewMode,
  defaultCardsOnMobile,
  cardsContainerClassName,
  defaultVisibility,
  externalSorting,
  externalColumnFilters,
  externalPagination,
  externalRowSelection,
  onExternalSortingChange,
  onExternalColumnFiltersChange,
  onExternalPaginationChange,
  onExternalRowSelectionChange,
  maxPageSize,
  fetching,
  pinnedColumns,
}: DataTableProps<TData>) {
  const storageBaseName = env.NEXT_PUBLIC_STORAGE_BASE_NAME;

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    useLocalStorage<VisibilityState>(
      `${storageBaseName}:${tableId}:columnVisibility`,
      {}
    );
  const [density, setDensity] = useLocalStorage<DensityOption>(
    `${storageBaseName}:${tableId}:rowDensity`,
    defaultDensity || "default"
  );
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    `${storageBaseName}:${tableId}:viewMode`,
    defaultViewMode || "table"
  );
  /** The person picked a view with the toggle: phones stop defaulting to cards. */
  const [viewModeChosen, setViewModeChosen] = useLocalStorage<boolean>(
    `${storageBaseName}:${tableId}:viewModeChosen`,
    false
  );
  const chooseViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeChosen(true);
      setViewMode(mode);
    },
    [setViewMode, setViewModeChosen]
  );

  const [sorting, setSorting] = useState<SortingState>(externalSorting || []);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    externalColumnFilters || []
  );
  const [pagination, setPagination] = useState<PaginationState>(
    externalPagination || {
      pageIndex: 0,
      pageSize: 10,
    }
  );

  useEffect(() => {
    if (defaultVisibility) {
      const sortedBreakpoints = Object.keys(defaultVisibility)
        .map(Number)
        .sort((a, b) => b - a);

      const handleResponsiveVisibility = () => {
        if (typeof window === "undefined") return;

        const windowWidth = window.innerWidth;
        let matchedVisibility: VisibilityState = {};

        for (const breakpoint of sortedBreakpoints) {
          if (windowWidth <= breakpoint) {
            matchedVisibility = defaultVisibility[breakpoint];
            break;
          }
        }

        setColumnVisibility((prev) => ({
          ...prev,
          ...matchedVisibility,
        }));
      };

      handleResponsiveVisibility();
    }
  }, [defaultVisibility, setColumnVisibility]);

  // Phones start on cards, until the toggle is used: forcing them on every
  // change undid "Exibir como tabela" at once.
  useEffect(() => {
    if (!renderCard || !defaultCardsOnMobile || viewModeChosen || typeof window === "undefined")
      return;
    if (window.innerWidth < 768 && viewMode !== "cards") {
      setViewMode("cards");
    }
  }, [defaultCardsOnMobile, renderCard, setViewMode, viewMode, viewModeChosen]);

  // Pinning is derived (props and visibility), never stored: TanStack only reads it.
  const leafIds = columns.map((column) => (column.id ?? (column as { accessorKey?: string }).accessorKey) as string);
  const shownIds = leafIds.filter(
    (id, index) =>
      id && columnVisibility[id] !== false && !(columns[index].meta as { isFilterOnly?: boolean } | undefined)?.isFilterOnly
  );
  const columnPinning = {
    start: pinnedColumns ? (pinnedColumns.start ?? []) : shownIds.slice(0, 1),
    end: pinnedColumns ? (pinnedColumns.end ?? []) : shownIds.length > 1 ? shownIds.slice(-1) : [],
  };

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: {
      columnPinning,
      sorting: externalSorting || sorting,
      columnVisibility,
      columnFilters: externalColumnFilters || columnFilters,
      pagination: externalPagination || pagination,
      rowSelection: externalRowSelection || rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: onExternalRowSelectionChange || setRowSelection,
    onSortingChange: onExternalSortingChange || setSorting,
    onColumnFiltersChange: onExternalColumnFiltersChange || setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: onExternalPaginationChange || setPagination,
    getRowId,
    manualPagination: !!onExternalPaginationChange,
    manualSorting: !!onExternalSortingChange,
    manualFiltering: !!onExternalColumnFiltersChange,
    rowCount: !!onExternalPaginationChange ? rowCount : undefined,
    meta: {
      tableId,
      // Cells size their buttons by it (see ./density.ts).
      density,
    },
  });

  // Phones get their own toolbar and "Carregar mais" instead of pages
  // (after hydration: the server renders the desktop one).
  const isMobile = useIsMobile();
  const compact = useHydrated() && isMobile;
  const { pageIndex, pageSize } = table.state.pagination;

  // A link to page 3 opened on a phone: the list from the top through it.
  useEffect(() => {
    if (!compact || pageIndex === 0) return;
    table.setPagination({
      pageIndex: 0,
      pageSize: Math.min((pageIndex + 1) * pageSize, maxPageSize ?? Number.POSITIVE_INFINITY),
    });
  }, [compact, pageIndex, pageSize, maxPageSize, table]);

  // A phone's grown size (a shared link) on a desktop: the nearest size the
  // pages offer, so "Linhas por página" shows one of its own.
  const hydrated = useHydrated();
  useEffect(() => {
    if (!hydrated || isMobile || !onExternalPaginationChange) return;
    const sizes: number[] = env.NEXT_PUBLIC_PAGE_SIZES;
    if (sizes.length === 0 || sizes.includes(pageSize)) return;
    const nearest = sizes.reduce((best, size) => (Math.abs(size - pageSize) < Math.abs(best - pageSize) ? size : best));
    table.setPagination({ pageIndex: 0, pageSize: nearest });
  }, [hydrated, isMobile, pageSize, onExternalPaginationChange, table]);

  const densityClasses = {
    spacious: "[&>td]:py-4 [&>td]:text-base",
    comfortable: "[&>td]:py-3",
    default: "[&>td]:py-2",
    compact: "[&>td]:py-1 [&>td]:text-sm",
    "ultra-compact": "[&>td]:py-0 [&>td]:text-xs",
  };

  const isTable = viewMode === "table" || !renderCard;
  const rows = table.getRowModel().rows;
  // Nothing on screen yet: placeholders shaped like the rows, not a spinner.
  const firstLoad = loading && rows.length === 0 && table.getCoreRowModel().rows.length === 0;
  const refreshing = loading && rows.length > 0;
  const filtered = table.state.columnFilters.length > 0;
  const clearFilters = () => table.setColumnFilters([]);
  const isShown = (meta: unknown) => !(meta as { isFilterOnly?: boolean } | undefined)?.isFilterOnly;
  const visibleColumns = table.getVisibleLeafColumns().filter((column) => isShown(column.columnDef.meta));

  // A new page starts at the top of the list (not where the last one ended).
  const top = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const toTop = () => {
    const viewport = scroller.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    if (viewport) viewport.scrollTop = 0;
    const box = top.current?.getBoundingClientRect();
    // Below the panel's header (48px).
    if (box && box.top < 64) {
      window.scrollTo({
        top: window.scrollY + box.top - 64,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  };

  // Scrolled sideways: the innermost pinned column of each side draws a line.
  const [edges, setEdges] = useState({ start: false, end: false });
  // Pinned columns' real widths: each one sticks after the ones before it.
  const headRow = useRef<HTMLTableRowElement>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  useEffect(() => {
    const viewport = scroller.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    if (!viewport) return;
    const update = () => {
      setEdges((prev) => {
        const next = {
          start: viewport.scrollLeft > 1,
          end: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
        };
        return prev.start === next.start && prev.end === next.end ? prev : next;
      });
      const measured: Record<string, number> = {};
      headRow.current?.querySelectorAll<HTMLElement>("th[data-column-id]").forEach((th) => {
        measured[th.dataset.columnId!] = th.getBoundingClientRect().width;
      });
      setWidths((prev) =>
        Object.keys(measured).length === Object.keys(prev).length &&
        Object.entries(measured).every(([id, width]) => Math.abs((prev[id] ?? -1) - width) < 0.5)
          ? prev
          : measured
      );
    };
    update();
    viewport.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    return () => {
      viewport.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [isTable]);

  const startPinned = table.getStartVisibleLeafColumns().filter((column) => isShown(column.columnDef.meta));
  const endPinned = table.getEndVisibleLeafColumns().filter((column) => isShown(column.columnDef.meta));
  const pins: Record<string, PinnedCell> = {};
  startPinned.reduce((offset, column, index) => {
    pins[column.id] = { side: "start", offset, line: edges.start && index === startPinned.length - 1 };
    return offset + (widths[column.id] ?? 0);
  }, 0);
  [...endPinned].reverse().reduce((offset, column, index) => {
    pins[column.id] = { side: "end", offset, line: edges.end && index === endPinned.length - 1 };
    return offset + (widths[column.id] ?? 0);
  }, 0);
  // Pinned on the sides, the rest in between, in that order.
  const orderedHeaders = [
    ...table.getStartLeafHeaders(),
    ...table.getCenterLeafHeaders(),
    ...table.getEndLeafHeaders(),
  ].filter((header) => isShown(header.column.columnDef.meta));
  const orderedCells = (row: Row<TData>) =>
    [...row.getStartVisibleCells(), ...row.getCenterVisibleCells(), ...row.getEndVisibleCells()].filter((cell) =>
      isShown(cell.column.columnDef.meta)
    );

  // Rows that open something: Tab reaches them, Enter opens, arrows move.
  const rowKeys = (row: Row<TData>) => (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        event.key === "ArrowDown"
          ? event.currentTarget.nextElementSibling
          : event.currentTarget.previousElementSibling;
      (next as HTMLElement | null)?.focus();
    }
  };

  // A little more room at the table's two edges.
  const edgePadding = "[&>*:first-child]:pl-4 [&>*:last-child]:pr-4";

  const emptyState = (
    <EmptyState filtered={filtered} onClear={clearFilters} />
  );

  return (
    // No clipping here: the phone's toolbar sticks to the page (overflow makes
    // a scroll box) and the search's focus ring isn't cut. The table's card
    // clips its own corners.
    <div ref={top}>
      {compact ? (
        <DataTableMobileToolbar
          table={table}
          columnsConfig={columnsConfig}
          hasCardView={!!renderCard}
          viewMode={viewMode}
          setViewMode={chooseViewMode}
          loading={loading}
        />
      ) : (
        <DataTableToolbar
          table={table}
          columnsConfig={columnsConfig}
          setDensity={setDensity}
          currentDensity={density}
          hasCardView={!!renderCard}
          viewMode={viewMode}
          setViewMode={chooseViewMode}
          loading={loading || fetching}
        />
      )}

      <div
        className={cn(
          "relative flex flex-col",
          isTable ? "overflow-hidden rounded-xl border bg-card shadow-xs" : "gap-4"
        )}
      >
        {refreshing && (
          <div className="absolute inset-x-0 top-0 z-5 h-0 overflow-visible">
            <Progress value={null} className="h-0.5 bg-transparent delay-300" />
          </div>
        )}
        {isTable ? (
          <ScrollArea
            ref={scroller}
            // The bars show while scrolling only: always there, the thin
            // vertical one read as a stray line beside the last column.
            type="scroll"
            scrollHideDelay={700}
            className={cn(
              // The header stays while a long page scrolls inside; the bars
              // pass over the pinned columns, never under them.
              "relative [&>[data-slot=scroll-area-scrollbar]]:z-10 [&>[data-slot=scroll-area-viewport]]:max-h-[max(28rem,calc(100dvh-12rem))]",
              wrapperClassName
            )}
          >
            <Table className={className}>
              {/* One line under the header: the cells draw it (the row's border would double it). */}
              <TableHeader className={cn("[&_tr]:border-0", tableHeaderClassName)}>
                <TableRow
                  ref={headRow}
                  className={cn(
                    "border-0 hover:bg-transparent [&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:h-11 [&>th]:bg-card [&>th]:shadow-[inset_0_-1px_0_var(--color-border)]",
                    edgePadding
                  )}
                >
                  {orderedHeaders.map((header) => {
                    const pin = pins[header.column.id] ?? null;
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        data-column-id={header.column.id}
                        // Pinned headers stick both ways and keep the line under the header.
                        style={pin ? { ...pinnedStyle(pin, HEADER_LINE), top: 0, zIndex: 3 } : undefined}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {firstLoad ? (
                  Array.from({ length: Math.min(table.state.pagination.pageSize, 8) }, (_, index) => (
                    <TableRow
                      key={index}
                      aria-hidden
                      className={cn("border-0 hover:bg-transparent [&>td]:border-b", edgePadding, densityClasses[density])}
                    >
                      {visibleColumns.map((column, cellIndex) => (
                        <TableCell key={column.id}>
                          <Skeleton
                            className="h-3.5"
                            style={{ width: `${48 + ((index * 7 + cellIndex * 13) % 40)}%` }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length > 0 ? (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? rowKeys(row) : undefined}
                      className={cn(
                        densityClasses[density],
                        // Opaque cells, so the pinned ones cover what scrolls under them.
                        // Lines on the cells, not the row: the pinned cells' own background
                        // would cover a row's border and leave it in another shade.
                        "border-0 hover:bg-transparent [&>td]:border-b [&>td]:bg-card last:[&>td]:border-b-0 hover:[&>td]:bg-[color-mix(in_oklch,var(--color-muted)_70%,var(--color-card))] data-[state=selected]:[&>td]:bg-muted",
                        edgePadding,
                        onRowClick &&
                          // The focus mark is drawn by the first cell (its shadow may be the pinned line).
                          "cursor-pointer outline-none [&>td:first-child]:relative focus-visible:[&>td]:bg-[color-mix(in_oklch,var(--color-muted)_70%,var(--color-card))] focus-visible:[&>td:first-child]:before:absolute focus-visible:[&>td:first-child]:before:inset-y-0 focus-visible:[&>td:first-child]:before:left-0 focus-visible:[&>td:first-child]:before:w-0.5 focus-visible:[&>td:first-child]:before:bg-primary"
                      )}
                    >
                      {orderedCells(row).map((cell) => (
                        <PinnedCellContext.Provider key={cell.id} value={pins[cell.column.id] ?? null}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </PinnedCellContext.Provider>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={visibleColumns.length || columns.length} className="h-64 text-center">
                      {emptyState}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" className="z-10" />
          </ScrollArea>
        ) : (
          <div
            className={cn("grid grid-cols-1 gap-3 p-1 sm:grid-cols-2 lg:grid-cols-3", cardsContainerClassName, wrapperClassName)}
          >
            {firstLoad ? (
              Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} aria-hidden className="h-44 rounded-xl" />
              ))
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <div
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {renderCard!(row)}
                </div>
              ))
            ) : (
              <div className="col-span-full flex h-64 items-center justify-center rounded-lg p-4 text-center">
                {emptyState}
              </div>
            )}
          </div>
        )}

        {compact ? (
          <DataTableLoadMore table={table} maxPageSize={maxPageSize} fetching={fetching} />
        ) : (
          (rows.length > 0 || firstLoad) && (
            <div className={cn(isTable ? "border-t bg-card px-4 py-2" : "px-1")}>
              <DataTablePagination table={table} onPageChange={toTop} />
            </div>
          )
        )}
      </div>
    </div>
  );
}

/**
 * No rows. Filtered: says so and offers to clear the search and filters;
 * otherwise, nothing was added yet.
 */
function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-1.5 whitespace-normal">
      <div className="mb-1.5 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {filtered ? <Search className="size-5" /> : <Inbox className="size-5" />}
      </div>
      <p className="font-semibold">{filtered ? "Nenhum resultado para essa busca" : "Nenhum registro encontrado"}</p>
      <p className="text-sm text-muted-foreground">
        {filtered ? "Tente outra busca ou tire algum filtro." : "Ainda não há nada cadastrado aqui."}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onClear}>
          Limpar busca e filtros
        </Button>
      )}
    </div>
  );
}
