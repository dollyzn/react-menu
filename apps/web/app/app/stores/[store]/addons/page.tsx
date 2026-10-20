"use client";

import { useParams } from "next/navigation";
import { useGetAddonsByStoreIdQuery } from "@/redux/features/addon/addonApi";
import { useTableQuery } from "@/hooks/use-table-query";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";

import { DataTable } from "@/components/data-table";
import { columns, columnsConfig, renderAddonCard } from "./components/columns";
import { CreateAddonDialog } from "./components/create-addon-dialog";
import { ManagementPageShell } from "../components/management-page-shell";

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
    <ManagementPageShell
      storeId={storeId}
      pageLabel="Adicionais"
      action={<CreateAddonDialog storeId={storeId} />}
    >
      <DataTable
        tableId={`addons-${storeId}`}
        loading={table.loading}
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
        renderCard={renderAddonCard}
        defaultCardsOnMobile
      />
    </ManagementPageShell>
  );
}
