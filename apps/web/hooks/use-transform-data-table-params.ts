import {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { filterToParam } from "@/hooks/use-url-table-state";

interface UseTransformTableParamsProps {
  filters: ColumnFiltersState;
  sorting: SortingState;
  pagination: PaginationState;
}

export const useTransformTableParams = ({
  filters,
  sorting,
  pagination,
}: UseTransformTableParamsProps) => {
  const filterParam = useMemo(() => {
    return filters.reduce(
      (acc, filter) => {
        // Arrays stay arrays; date ranges become "from~to" (not "[object Object]").
        const value = filterToParam(filter.value);
        if (value !== undefined) acc[filter.id] = value;
        return acc;
      },
      {} as Record<string, unknown>
    );
  }, [filters]);

  const sortingParam = useMemo(() => {
    return sorting.map((sort) => `${sort.id}:${sort.desc ? "desc" : "asc"}`);
  }, [sorting]);

  const paginationParam = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    }),
    [pagination]
  );

  return {
    filterParam,
    sortingParam,
    paginationParam,
  };
};
