import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@/components/app/data-table/features";
import { useTransformTableParams } from "@/hooks/use-transform-data-table-params";
import { useUrlTableState } from "@/hooks/use-url-table-state";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { Meta, Pagination } from "@/types/request";
import type { FacetCounts } from "@react-menu/contracts";
import { getMetaTotal } from "@/types/paginated-list";
import { useState } from "react";

type UseQueryResult<R> = {
  data?: R;
  isFetching: boolean;
  refetch: () => unknown;
};

type UseQueryHook<R, A> = (arg: A) => UseQueryResult<R>;

export interface UseTableQueryOptions {
  initialPagination?: PaginationState;
  initialSorting?: SortingState;
  initialFilters?: ColumnFiltersState;
}

export interface TableQueryReturn<T> {
  data: T[];
  loading: boolean;
  rowCount: number;
  /** Counts per filter option, when the endpoint sends them (`meta.facets`). */
  facets?: FacetCounts;
  pagination: PaginationState;
  sorting: SortingState;
  filters: ColumnFiltersState;
  setPagination: (
    updater: PaginationState | ((p: PaginationState) => PaginationState)
  ) => void;
  setSorting: (
    updater: SortingState | ((s: SortingState) => SortingState)
  ) => void;
  setFilters: (
    updater:
      | ColumnFiltersState
      | ((f: ColumnFiltersState) => ColumnFiltersState)
  ) => void;
  refetch: () => void;
}

/**
 * useTableQuery centraliza o estado da tabela (paginação, ordenação, filtros,
 * guardados na URL por useUrlTableState) e integra com um hook de RTK Query
 * fornecido (ex.: useGetItemsByStoreIdQuery).
 *
 * T: tipo do item da lista
 * R: resposta do endpoint contendo { data: T[]; meta: Meta }
 * A: argumento do endpoint RTK (ex.: `StoreScopedListArg`).
 */
export function useTableQuery<
  T,
  R extends { data: T[]; meta: Meta },
  A extends StoreScopedListArg
>(
  useQueryHook: UseQueryHook<R, A>,
  buildArg: (params: {
    filterParam: Record<string, unknown>;
    sortingParam: string[];
    paginationParam: Pagination;
  }) => A,
  options?: UseTableQueryOptions
): TableQueryReturn<T> {
  // Page, sorting and filters live in the URL (survive reloads, shareable).
  const { pagination, sorting, filters, setPagination, setSorting, setFilters } = useUrlTableState({
    pageSize: options?.initialPagination?.pageSize,
    sorting: options?.initialSorting,
    filters: options?.initialFilters,
  });

  const { filterParam, sortingParam, paginationParam } =
    useTransformTableParams({ filters, sorting, pagination });

  // The filter options' counts are asked on the first page only (a filter
  // change always goes back to it); the next pages reuse them.
  const queryArg = { ...buildArg({ filterParam, sortingParam, paginationParam }), facets: pagination.pageIndex === 0 };
  const { data: queryData, isFetching, refetch } = useQueryHook(queryArg);

  // Counts belong to one set of filters: kept across pages, never shown for
  // other filters (while those load, no counts rather than wrong ones).
  const filterKey = JSON.stringify(filterParam);
  const [kept, setKept] = useState<{ key: string; facets?: FacetCounts }>({ key: filterKey });
  const fresh = queryData?.meta?.facets;
  if (fresh && !isFetching && (kept.key !== filterKey || kept.facets !== fresh)) setKept({ key: filterKey, facets: fresh });
  const facets = kept.key === filterKey ? kept.facets : undefined;

  return {
    data: queryData?.data ?? [],
    loading: isFetching,
    rowCount: getMetaTotal(queryData?.meta),
    facets,
    pagination,
    sorting,
    filters,
    setPagination,
    setSorting,
    setFilters,
    refetch,
  };
}
