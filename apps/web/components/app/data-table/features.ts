import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_equals,
  filterFn_inDateRange,
  filterFn_inNumberRange,
  filterFn_includesString,
  filterFn_weakEquals,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  type CellContext as TanstackCellContext,
  type Column as TanstackColumn,
  type ColumnDef as TanstackColumnDef,
  type HeaderContext as TanstackHeaderContext,
  type Row as TanstackRow,
  type RowData,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import type { DensityOption } from ".";

export interface DataTableMeta {
  tableId: string;
  /** Cells size their buttons by it (see ./density.ts). */
  density?: DensityOption;
}

export interface DataTableColumnMeta {
  /** Label in the view options, filters and the cards' sort selector. */
  name: string;
  isFilterOnly?: boolean;
}

/**
 * What every DataTable can do (Table v9 exposes only registered features).
 * The screens page, sort and filter on the API (manual mode); the client row
 * models keep tables without external state working. The function registries
 * hold what `'auto'` resolves to.
 */
export const dataTableFeatures = tableFeatures({
  columnVisibilityFeature,
  columnFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns: {
    includesString: filterFn_includesString,
    inNumberRange: filterFn_inNumberRange,
    equals: filterFn_equals,
    arrIncludes: filterFn_arrIncludes,
    inDateRange: filterFn_inDateRange,
    weakEquals: filterFn_weakEquals,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
    basic: sortFn_basic,
  },
  tableMeta: metaHelper<DataTableMeta>(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

// The table types bound to these features, so screens keep writing `Row<Item>`.
export type ColumnDef<TData extends RowData, TValue = unknown> = TanstackColumnDef<DataTableFeatures, TData, TValue>;
export type Column<TData extends RowData, TValue = unknown> = TanstackColumn<DataTableFeatures, TData, TValue>;
export type Row<TData extends RowData> = TanstackRow<DataTableFeatures, TData>;
export type Table<TData extends RowData> = TanstackTable<DataTableFeatures, TData>;
export type HeaderContext<TData extends RowData, TValue = unknown> = TanstackHeaderContext<DataTableFeatures, TData, TValue>;
export type CellContext<TData extends RowData, TValue = unknown> = TanstackCellContext<DataTableFeatures, TData, TValue>;
export type {
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  ColumnVisibilityState as VisibilityState,
} from "@tanstack/react-table";
