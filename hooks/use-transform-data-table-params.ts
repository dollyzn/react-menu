import {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from "@tanstack/react-table";
import { useMemo } from "react";

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
        if (Array.isArray(filter.value)) {
          acc[filter.id] = filter.value;
        } else {
          acc[filter.id] = String(filter.value);
        }
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
