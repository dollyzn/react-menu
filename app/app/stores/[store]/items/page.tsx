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

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ColumnsConfig, DataTable } from "@/components/data-table";
import { columns } from "./components/columns";
import { CreateItemDialog } from "./components/create-item-dialog";

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
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/app/stores/${store}`}>
                Loja
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Items</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CreateItemDialog />
      </div>

      <DataTable<Item, unknown>
        tableId={`items-${storeId}`}
        loading={table.loading && table.data.length === 0}
        data={table.data}
        rowCount={table.rowCount}
        columns={columns}
        columnsConfig={columnsConfig}
        wrapperClassName="rounded-lg shadow-md"
        className="bg-card"
        externalPagination={table.pagination}
        onExternalPaginationChange={table.setPagination}
        externalSorting={table.sorting}
        onExternalSortingChange={table.setSorting}
        externalColumnFilters={table.filters}
        onExternalColumnFiltersChange={table.setFilters}
      />
    </div>
  );
}
