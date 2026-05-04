import { Table } from "@tanstack/react-table";
import { useMemo } from "react";
import { Filter, FilterX, LayoutGrid, Table2, X } from "lucide-react";
import { ColumnsConfig, DensityOption, ViewMode } from ".";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableDateRangeFilter } from "./data-table-date-range-filter";
import { DataTableFilterButton } from "./data-table-filter-button";
import { DataTableSelectFilter } from "./data-table-select-filter";
import { DataTableDensityToggle } from "./data-table-density-toggle";
import DataTableCardsSortSelector from "./data-table-cards-sort-selector";
import DataTableViewOptions from "./data-table-view-options";
import { AnimatePresence, motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn, mergeRefs } from "@/lib/utils";
import { useHorizontalHoverScroll } from "@/hooks/use-horizontal-hover-scroll";
import { useHorizontalScrollEffects } from "@/hooks/use-horizontal-scroll-effects";
import { useLocalStorage } from "usehooks-ts";
import { env } from "@/lib/env";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  columnsConfig?: ColumnsConfig[];
  setDensity: (density: DensityOption) => void;
  currentDensity: DensityOption;
  hasCardView: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export function DataTableToolbar<TData>({
  table,
  columnsConfig,
  setDensity,
  currentDensity,
  hasCardView,
  viewMode,
  setViewMode,
}: DataTableToolbarProps<TData>) {
  const storageBaseName = env.NEXT_PUBLIC_STORAGE_BASE_NAME;

  const isMobile = useIsMobile(840);
  const hoverScroll = useHorizontalHoverScroll();
  const scrollEffects = useHorizontalScrollEffects();

  const [showFilters, setShowFilters] = useLocalStorage<boolean>(
    `${storageBaseName}:${table.options.meta?.tableId}:showFilters`,
    true
  );

  const isFiltered = table.getState().columnFilters.length > 0;
  const filtersCount = table.getState().columnFilters.length;

  const filterControls = useMemo(
    () => (
      <>
        {columnsConfig?.map(
          (columnConfig) =>
            columnConfig.searchable &&
            !!table.getColumn(columnConfig.key) && (
              <DataTableFilterButton
                key={columnConfig.key}
                column={table.getColumn(columnConfig.key)!}
              />
            )
        )}

        {columnsConfig?.map((columnConfig) => {
          const column = table.getColumn(columnConfig.key);

          // Suporta filtros em colunas virtuais (column pode ser undefined)
          if (!columnConfig.searchable && column) {
            if (columnConfig.type === "select") {
              return (
                <DataTableSelectFilter
                  key={columnConfig.key}
                  column={column}
                  options={columnConfig.filterOptions}
                  loading={columnConfig.loading}
                  grouped={columnConfig.grouped}
                />
              );
            } else if (columnConfig.type === "date-range") {
              return (
                <DataTableDateRangeFilter
                  key={columnConfig.key}
                  column={column}
                  title={columnConfig.title}
                />
              );
            } else {
              return (
                <DataTableFacetedFilter
                  key={columnConfig.key}
                  column={column}
                  options={columnConfig.filterOptions}
                  loading={columnConfig.loading}
                  grouped={columnConfig.grouped}
                />
              );
            }
          }
          return null;
        })}
      </>
    ),
    [columnsConfig, table]
  );

  const leftActions = (
    <>
      {columnsConfig && columnsConfig.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          {showFilters ? (
            <FilterX className="size-4" />
          ) : (
            <Filter className="size-4" />
          )}
          {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
          <Badge
            variant="outline"
            className="h-5 min-w-5 rounded-sm px-1 font-mono tabular-nums"
          >
            {filtersCount}
          </Badge>
        </Button>
      )}

      {isFiltered && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.resetColumnFilters()}
          className="h-8 px-2 lg:px-3 border-dashed"
        >
          Limpar
          <X className="size-4" />
        </Button>
      )}
    </>
  );

  const rightActions = (
    <>
      <DataTableDensityToggle
        currentDensity={currentDensity}
        setDensity={setDensity}
      />
      {viewMode === "cards" ? (
        <DataTableCardsSortSelector table={table} />
      ) : (
        <DataTableViewOptions table={table} />
      )}

      {hasCardView && (
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
        >
          <LayoutGrid
            className={cn(
              "transition-all",
              viewMode === "table" ? "scale-100" : "scale-0"
            )}
          />
          <Table2
            className={cn(
              "absolute transition-all",
              viewMode === "cards" ? "scale-100" : "scale-0"
            )}
          />
        </Button>
      )}
    </>
  );

  return (
    <>
      <div
        className={cn(
          "flex flex-row items-center flex-wrap gap-2 pb-4",
          !isMobile && "justify-between"
        )}
      >
        {isMobile ? (
          <>
            {leftActions}
            {rightActions}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">{leftActions}</div>

            <div className="flex items-center gap-2 justify-end">
              {rightActions}
            </div>
          </>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {showFilters && columnsConfig && columnsConfig.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="relative pb-4">
              {scrollEffects.showLeft && (
                <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-linear-to-r from-background to-transparent z-1" />
              )}
              {scrollEffects.showRight && (
                <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-linear-to-l from-background to-transparent z-1" />
              )}
              <ScrollArea
                ref={mergeRefs(
                  hoverScroll.containerRef,
                  scrollEffects.containerRef
                )}
                {...hoverScroll.events}
                className="w-full"
              >
                <ScrollBar
                  orientation="horizontal"
                  className="top-[-13px] data-[state=visible]:animate-in data-[state=hidden]:animate-out fade-in fade-out duration-300"
                />
                <div className="flex w-max items-center gap-2">
                  {filterControls}
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
