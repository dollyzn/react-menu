"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useGetCategoriesByStoreIdQuery } from "@/redux/features/category/categoryApi";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { useGetItemsByStoreIdQuery } from "@/redux/features/item/itemApi";
import { useTableQuery } from "@/hooks/use-table-query";
import {
  storeListPrefetchArg,
  type StoreScopedListArg,
} from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";

import { ColumnsConfig, DataTable } from "@/components/data-table";
import { columns, renderItemCard } from "./components/columns";
import { CreateItemDialog } from "./components/create-item-dialog";
import { ManagementPageShell } from "../components/management-page-shell";

export default function Items() {
  const { store } = useParams();
  const storeId = store as string;

  const { data: categoriesPage } = useGetCategoriesByStoreIdQuery(
    storeListPrefetchArg(storeId)
  );
  useGetAddonsByStoreIdQuery(storeListPrefetchArg(storeId));

  const table = useTableQuery<Item, PaginatedList<Item>, StoreScopedListArg>(
    useGetItemsByStoreIdQuery,
    ({ filterParam, sortingParam, paginationParam }) => {
      return {
        storeId,
        filters: filterParam as Record<
          string,
          string | string[] | null | undefined
        >,
        sort: sortingParam,
        pagination: paginationParam,
      };
    }
  );

  const categoryFilterOptions = useMemo(() => {
    const names = (categoriesPage?.data ?? [])
      .map((c) => c.name)
      .filter(Boolean) as string[];
    return Array.from(new Set(names)).map((name) => ({
      value: name,
      label: name,
    }));
  }, [categoriesPage?.data]);

  const columnsConfig: ColumnsConfig[] = useMemo(
    () => [
      {
        key: "name",
        searchable: true,
      },
      {
        key: "category.name",
        filterOptions: categoryFilterOptions,
      },
    ],
    [categoryFilterOptions]
  );

  return (
    <ManagementPageShell
      storeId={storeId}
      pageLabel="Itens"
      action={<CreateItemDialog />}
    >
      <DataTable<Item, unknown>
        tableId={`items-${storeId}`}
        loading={table.loading && table.data.length === 0}
        data={table.data}
        rowCount={table.rowCount}
        columns={columns}
        columnsConfig={columnsConfig}
        className="bg-card"
        externalPagination={table.pagination}
        onExternalPaginationChange={table.setPagination}
        externalSorting={table.sorting}
        onExternalSortingChange={table.setSorting}
        externalColumnFilters={table.filters}
        onExternalColumnFiltersChange={table.setFilters}
        renderCard={renderItemCard}
        defaultCardsOnMobile
      />
    </ManagementPageShell>
  );
}
