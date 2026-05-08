import { Fragment, useEffect, useState } from "react";
import {
  type ColumnDef,
  type Row,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  RowSelectionState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useLocalStorage } from "usehooks-ts";
import { env } from "@/lib/env";

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

interface DefaultVisibility {
  [breakpoint: number]: VisibilityState;
}

interface DataTableProps<TData, TValue> {
  tableId: string;
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
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
}

export function DataTable<TData, TValue>({
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
}: DataTableProps<TData, TValue>) {
  const storageBaseName = env.NEXT_PUBLIC_STORAGE_BASE_NAME;

  const [rowSelection, setRowSelection] = useState({});
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
  }, [defaultVisibility]);

  useEffect(() => {
    if (!renderCard || !defaultCardsOnMobile || typeof window === "undefined")
      return;
    if (window.innerWidth < 768 && viewMode !== "cards") {
      setViewMode("cards");
    }
  }, [defaultCardsOnMobile, renderCard, setViewMode, viewMode]);

  const table = useReactTable({
    data,
    columns,
    state: {
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
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId,
    manualPagination: !!onExternalPaginationChange,
    manualSorting: !!onExternalSortingChange,
    manualFiltering: !!onExternalColumnFiltersChange,
    rowCount: !!onExternalPaginationChange ? rowCount : undefined,
    meta: {
      tableId,
    },
  });

  const densityClasses = {
    spacious: "[&>td]:py-4 [&>td]:text-base",
    comfortable: "[&>td]:py-3",
    default: "[&>td]:py-2",
    compact: "[&>td]:py-1 [&>td]:text-sm",
    "ultra-compact": "[&>td]:py-0 [&>td]:text-xs",
  };

  return (
    <div>
      <DataTableToolbar
        table={table}
        columnsConfig={columnsConfig}
        setDensity={setDensity}
        currentDensity={density}
        hasCardView={!!renderCard}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <div className="space-y-4 relative">
        <ScrollArea
          className={cn(
            "rounded-lg relative",
            viewMode === "table" && "border",
            wrapperClassName
          )}
        >
          <ScrollBar
            orientation="horizontal"
            className="h-3 [&>*:first-child]:bg-primary data-[state=visible]:animate-in data-[state=hidden]:animate-out fade-in fade-out duration-300"
            style={{ top: "-15px" }}
          />
          {loading &&
            table.getRowModel().rows.length > 0 &&
            table.getCoreRowModel().rows.length > 0 && (
              <div className="sticky h-0 overflow-visible top-0 z-5">
                <Progress value={null} className="bg-transparent delay-500" />
              </div>
            )}
          {viewMode === "table" || !renderCard ? (
            <Table className={className}>
              <TableHeader className={tableHeaderClassName}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers
                      .filter((item) => {
                        const meta = item.column.columnDef.meta as
                          | { isFilterOnly?: boolean }
                          | undefined;
                        return !meta?.isFilterOnly;
                      })
                      .map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading &&
                table.getRowModel().rows.length === 0 &&
                table.getCoreRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-52 text-center"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 size={24} className="animate-spin mb-2" />
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      onClick={() => {
                        if (onRowClick) {
                          onRowClick(row);
                        }
                      }}
                      className={cn(
                        densityClasses[density],
                        onRowClick && "cursor-pointer"
                      )}
                    >
                      {row
                        .getVisibleCells()
                        .filter((item) => {
                          const meta = item.column.columnDef.meta as
                            | { isFilterOnly?: boolean }
                            | undefined;
                          return !meta?.isFilterOnly;
                        })
                        .map((cell) => (
                          <Fragment key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </Fragment>
                        ))}
                    </TableRow>
                  ))
                ) : table.getCoreRowModel().rows.length > 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-52 text-center"
                    >
                      <div className="max-w-[400px] mx-auto">
                        <Search size={35} className="mx-auto mb-2" />
                        <p className="text-lg font-semibold">
                          Nenhum resultado encontrado
                        </p>
                        <p className="text-sm whitespace-normal">
                          Não encontramos registros que correspondam aos filtros
                          aplicados. Tente alterar os filtros ou redefini-los.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-52 text-center"
                    >
                      <div className="max-w-[400px] mx-auto">
                        <AlertCircle size={35} className="mx-auto mb-2" />
                        <p className="text-lg font-semibold">
                          Nenhum registro encontrado
                        </p>
                        <p className="text-sm whitespace-normal">
                          Parece que ainda não há nenhum registro criado no
                          sistema. Por favor, verifique novamente mais tarde.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 gap-3 p-1 sm:grid-cols-2 lg:grid-cols-3",
                cardsContainerClassName
              )}
            >
              {loading &&
              table.getRowModel().rows.length === 0 &&
              table.getCoreRowModel().rows.length === 0 ? (
                <div className="col-span-full h-52 flex items-center justify-center text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 size={24} className="animate-spin mb-2" />
                    Carregando...
                  </div>
                </div>
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => {
                      if (onRowClick) {
                        onRowClick(row);
                      }
                    }}
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {renderCard(row)}
                  </div>
                ))
              ) : table.getCoreRowModel().rows.length > 0 ? (
                <div className="col-span-full h-52 text-center flex items-center justify-center rounded-lg p-4">
                  <div className="max-w-[400px] mx-auto">
                    <Search size={35} className="mx-auto mb-2" />
                    <p className="text-lg font-semibold">
                      Nenhum resultado encontrado
                    </p>
                    <p className="text-sm whitespace-normal">
                      Não encontramos registros que correspondam aos filtros
                      aplicados. Tente alterar os filtros ou redefini-los.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="col-span-full h-52 text-center flex items-center justify-center rounded-lg p-4">
                  <div className="max-w-[400px] mx-auto">
                    <AlertCircle size={35} className="mx-auto mb-2" />
                    <p className="text-lg font-semibold">
                      Nenhum registro encontrado
                    </p>
                    <p className="text-sm whitespace-normal">
                      Parece que ainda não há nenhum registro criado no sistema.
                      Por favor, verifique novamente mais tarde.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          {loading &&
            table.getRowModel().rows.length > 0 &&
            table.getCoreRowModel().rows.length > 0 && (
              <div className="relative -top-1 h-0 overflow-visible">
                <Progress value={null} className="bg-transparent delay-100" />
              </div>
            )}
          <ScrollBar
            orientation="horizontal"
            className="h-3 [&>*:first-child]:bg-primary data-[state=visible]:animate-in data-[state=hidden]:animate-out fade-in fade-out duration-300"
            style={{ bottom: "-15px" }}
          />
        </ScrollArea>
        <div className="sticky bottom-0 bg-background/40 rounded-md py-2 px-1 backdrop-blur-xs ">
          <DataTablePagination table={table} />
        </div>
      </div>
    </div>
  );
}
