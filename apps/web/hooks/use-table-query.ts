import { useState } from "react";
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useTransformTableParams } from "@/hooks/use-transform-data-table-params";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { Meta, Pagination } from "@/types/request";
import { getMetaTotal } from "@/types/paginated-list";

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
 * useTableQuery centraliza o estado da tabela (paginação, ordenação, filtros)
 * e integra com um hook de RTK Query fornecido (ex.: useGetClientsQuery).
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
  const [pagination, setPagination] = useState<PaginationState>(
    options?.initialPagination ?? { pageIndex: 0, pageSize: 10 }
  );
  const [sorting, setSorting] = useState<SortingState>(
    options?.initialSorting ?? []
  );
  const [filters, setFilters] = useState<ColumnFiltersState>(
    options?.initialFilters ?? []
  );

  const { filterParam, sortingParam, paginationParam } =
    useTransformTableParams({ filters, sorting, pagination });

  const queryArg = buildArg({ filterParam, sortingParam, paginationParam });
  const { data: queryData, isFetching, refetch } = useQueryHook(queryArg);

  return {
    data: queryData?.data ?? [],
    loading: isFetching,
    rowCount: getMetaTotal(queryData?.meta),
    pagination,
    sorting,
    filters,
    setPagination,
    setSorting,
    setFilters,
    refetch,
  };
}
