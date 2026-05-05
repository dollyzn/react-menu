"use client";

import { useParams } from "next/navigation";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { useTableQuery } from "@/hooks/use-table-query";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DataTable } from "@/components/data-table";
import { columns, columnsConfig } from "./components/columns";
import { CreateAddonDialog } from "./components/create-addon-dialog";

export default function Addons() {
  const { store } = useParams();
  const storeId = store as string;

  const table = useTableQuery<Addon, PaginatedList<Addon>, StoreScopedListArg>(
    useGetAddonsByStoreIdQuery,
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
              <BreadcrumbPage>Adicionais</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CreateAddonDialog storeId={storeId} />
      </div>

      <DataTable
        tableId={`addons-${storeId}`}
        loading={table.loading}
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
