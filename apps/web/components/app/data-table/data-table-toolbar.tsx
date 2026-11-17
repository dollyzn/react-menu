import type { RowData } from "@tanstack/react-table";
import type { DataTableInstance } from ".";
import { LayoutGrid, Table2 } from "lucide-react";
import { ColumnsConfig, DensityOption, ViewMode } from ".";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";
import { DataTableDateRangeFilter } from "./data-table-date-range-filter";
import { DataTableSearch } from "./data-table-search";
import { DataTableSelectFilter } from "./data-table-select-filter";
import { DataTableDensityToggle } from "./data-table-density-toggle";
import DataTableCardsSortSelector from "./data-table-cards-sort-selector";
import DataTableViewOptions from "./data-table-view-options";
import { cn } from "@/lib/utils";

interface DataTableToolbarProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  columnsConfig?: ColumnsConfig[];
  setDensity: (density: DensityOption) => void;
  currentDensity: DensityOption;
  hasCardView: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** Rows still on their way (the count may be about to change). */
  loading?: boolean;
}

/**
 * Desktop: the search as a field ("/" focuses it) and every filter beside it,
 * always on screen (active ones tinted with what they hold), "Limpar
 * filtros" when any is set; on the right, how many results, then sorting
 * (cards) or density and columns (table), and the view switch.
 */
export function DataTableToolbar<TData extends RowData>({
  table,
  columnsConfig = [],
  setDensity,
  currentDensity,
  hasCardView,
  viewMode,
  setViewMode,
  loading,
}: DataTableToolbarProps<TData>) {
  const searchConfig = columnsConfig.find((config) => config.searchable && table.getColumn(config.key));
  const filterConfigs = columnsConfig.filter((config) => !config.searchable);
  const own = (id: string) => filterConfigs.some((config) => config.key === id);
  const filtering = table.state.columnFilters.some((filter) => own(filter.id));
  const count = table.getRowCount();

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      {searchConfig && (
        <DataTableSearch
          table={table}
          columnId={searchConfig.key}
          shortcut
          wrapperClassName="w-full sm:w-64 lg:w-72"
          className="h-8"
        />
      )}

      {/* Not memoized: `table` keeps the same reference while its state changes. */}
      {filterConfigs.map((columnConfig) => {
        const column = table.getColumn(columnConfig.key);
        if (!column) return null;
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
        }
        if (columnConfig.type === "date-range") {
          return <DataTableDateRangeFilter key={columnConfig.key} column={column} title={columnConfig.title} />;
        }
        return (
          <DataTableFacetedFilter
            key={columnConfig.key}
            column={column}
            options={columnConfig.filterOptions}
            loading={columnConfig.loading}
            grouped={columnConfig.grouped}
          />
        );
      })}

      {filtering && (
        <Button
          variant="link"
          size="sm"
          className="h-8 px-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => table.setColumnFilters((filters) => filters.filter((filter) => !own(filter.id)))}
        >
          Limpar filtros
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span
          className={cn("flex items-center gap-1.5 px-1 text-xs text-muted-foreground tabular-nums")}
          aria-live="polite"
        >
          {loading && <Spinner className="size-3" aria-hidden />}
          {loading && count === 0 ? "Carregando…" : count === 1 ? "1 resultado" : `${count} resultados`}
        </span>
        {viewMode === "cards" ? (
          <DataTableCardsSortSelector table={table} />
        ) : (
          <>
            {/* Row spacing means nothing for cards. */}
            <DataTableDensityToggle currentDensity={currentDensity} setDensity={setDensity} />
            <DataTableViewOptions table={table} />
          </>
        )}
        {hasCardView && (
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={viewMode === "cards" ? "Exibir como tabela" : "Exibir como cartões"}
            onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
          >
            <LayoutGrid className={cn("transition-all", viewMode === "table" ? "scale-100" : "scale-0")} />
            <Table2 className={cn("absolute transition-all", viewMode === "cards" ? "scale-100" : "scale-0")} />
          </Button>
        )}
      </div>
    </div>
  );
}
