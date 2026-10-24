"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ColumnFiltersState, PaginationState, SortingState } from "@/components/app/data-table/features";
import { format, isValid, parse } from "date-fns";

/**
 * Table state (page, page size, sorting, filters) kept in the URL, so a
 * reload or a shared link shows the same view:
 *
 *   ?page=2&size=20&sort=price.desc,name.asc&f.name=carne&f.category.name[]=Bebidas
 *
 * Date ranges are `f.createdAt=2026-10-01~2026-10-20`. Writes use
 * history.replaceState (Next keeps useSearchParams in sync, no refetch of the
 * page). Changing filters or sorting goes back to the first page.
 */
export interface TableUrlDefaults {
  pageSize?: number;
  sorting?: SortingState;
  filters?: ColumnFiltersState;
}

type Updater<T> = T | ((previous: T) => T);
const resolve = <T,>(updater: Updater<T>, previous: T) =>
  typeof updater === "function" ? (updater as (p: T) => T)(previous) : updater;

const DATE = "yyyy-MM-dd";
const RANGE = /^(\d{4}-\d{2}-\d{2})?~(\d{4}-\d{2}-\d{2})?$/;

function decodeFilterValue(raw: string): unknown {
  const range = RANGE.exec(raw);
  if (!range) return raw;
  const toDate = (value?: string) => {
    if (!value) return undefined;
    const date = parse(value, DATE, new Date());
    return isValid(date) ? date : undefined;
  };
  return { from: toDate(range[1]), to: toDate(range[2]) };
}

function encodeFilterValue(value: unknown): string[] | string | null {
  if (value === undefined || value === null || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.map(String) : null;
  if (typeof value === "object" && ("from" in value || "to" in value)) {
    const { from, to } = value as { from?: Date; to?: Date };
    if (!from && !to) return null;
    return `${from ? format(from, DATE) : ""}~${to ? format(to, DATE) : ""}`;
  }
  return String(value);
}

const OWN_KEY = (key: string) => key === "page" || key === "size" || key === "sort" || key.startsWith("f.");

export function useUrlTableState(defaults: TableUrlDefaults = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const defaultPageSize = defaults.pageSize ?? 10;

  const state = useMemo(() => {
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const size = Number(searchParams.get("size")) || defaultPageSize;
    const sortParam = searchParams.get("sort");
    const sorting: SortingState =
      sortParam === null
        ? (defaults.sorting ?? [])
        : sortParam
            .split(",")
            .filter(Boolean)
            .map((entry) => {
              const dot = entry.lastIndexOf(".");
              return { id: entry.slice(0, dot), desc: entry.slice(dot + 1) === "desc" };
            });

    const filters: ColumnFiltersState = [];
    const hasFilterParams = [...searchParams.keys()].some((key) => key.startsWith("f."));
    for (const key of new Set(searchParams.keys())) {
      if (!key.startsWith("f.")) continue;
      if (key.endsWith("[]")) {
        filters.push({ id: key.slice(2, -2), value: searchParams.getAll(key) });
      } else {
        filters.push({ id: key.slice(2), value: decodeFilterValue(searchParams.get(key) ?? "") });
      }
    }

    return {
      pagination: { pageIndex: page - 1, pageSize: size } satisfies PaginationState,
      sorting,
      filters: hasFilterParams ? filters : (defaults.filters ?? []),
    };
    // Defaults are initial values only; the URL is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, defaultPageSize]);

  const write = useCallback(
    (next: { pagination: PaginationState; sorting: SortingState; filters: ColumnFiltersState }) => {
      const params = new URLSearchParams(window.location.search);
      for (const key of [...params.keys()]) if (OWN_KEY(key)) params.delete(key);

      if (next.pagination.pageIndex > 0) params.set("page", String(next.pagination.pageIndex + 1));
      if (next.pagination.pageSize !== defaultPageSize) params.set("size", String(next.pagination.pageSize));
      if (next.sorting.length > 0) {
        params.set("sort", next.sorting.map((s) => `${s.id}.${s.desc ? "desc" : "asc"}`).join(","));
      } else if (defaults.sorting?.length) {
        params.set("sort", ""); // explicit "no sorting" over the default
      }
      for (const filter of next.filters) {
        const encoded = encodeFilterValue(filter.value);
        if (encoded === null) continue;
        if (Array.isArray(encoded)) encoded.forEach((value) => params.append(`f.${filter.id}[]`, value));
        else params.set(`f.${filter.id}`, encoded);
      }

      const query = params.toString();
      // null state: Next syncs useSearchParams only for app-made history entries.
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [pathname, defaultPageSize, defaults.sorting]
  );

  const setPagination = useCallback(
    (updater: Updater<PaginationState>) => write({ ...state, pagination: resolve(updater, state.pagination) }),
    [state, write]
  );
  const setSorting = useCallback(
    (updater: Updater<SortingState>) =>
      write({ ...state, sorting: resolve(updater, state.sorting), pagination: { ...state.pagination, pageIndex: 0 } }),
    [state, write]
  );
  const setFilters = useCallback(
    (updater: Updater<ColumnFiltersState>) =>
      write({ ...state, filters: resolve(updater, state.filters), pagination: { ...state.pagination, pageIndex: 0 } }),
    [state, write]
  );

  return { ...state, setPagination, setSorting, setFilters };
}

/** API value for a filter: arrays stay arrays, date ranges become "from~to". */
export function filterToParam(value: unknown): string | string[] | undefined {
  const encoded = encodeFilterValue(value);
  return encoded ?? undefined;
}
