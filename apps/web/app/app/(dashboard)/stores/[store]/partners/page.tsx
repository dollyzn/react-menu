"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PartnerListRow } from "@react-menu/contracts";
import { DataTable } from "@/components/data-table";
import { useTableQuery } from "@/hooks/use-table-query";
import { businessToday, lastDays, toLocalDate } from "@/lib/report-period";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import { useGetPartnersPageQuery } from "@/redux/features/partner/partnersApi";
import type { PaginatedList } from "@/types/paginated-list";
import { ManagementPageShell } from "../components/management-page-shell";
import { columns, columnsConfig, renderPartnerCard } from "./components/columns";
import { CreatePartnerDialog } from "./components/create-partner-dialog";

/**
 * Partners (ADR 0024; managers): who sells the menu outside the store, how
 * much each sold in the period, and the commission still to pay.
 */
export default function PartnersPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const router = useRouter();
  // The last 30 days unless the URL says otherwise.
  const initialFilters = useMemo(() => {
    const { from, to } = lastDays(30, businessToday());
    return [{ id: "createdAt", value: { from: toLocalDate(from), to: toLocalDate(to) } }];
  }, []);

  const table = useTableQuery<PartnerListRow, PaginatedList<PartnerListRow>, StoreScopedListArg>(
    useGetPartnersPageQuery,
    ({ filterParam, sortingParam, paginationParam }) => ({
      storeId,
      filters: filterParam as Record<string, string | string[] | null | undefined>,
      sort: sortingParam,
      pagination: paginationParam,
    }),
    { initialFilters }
  );

  return (
    <ManagementPageShell
      storeId={storeId}
      pageLabel="Parceiros"
      description="Quem vende o cardápio fora da loja, quanto vendeu no período e a comissão a pagar."
      action={<CreatePartnerDialog storeId={storeId} />}
    >
      <DataTable<PartnerListRow>
        tableId={`partners-${storeId}`}
        loading={table.loading && table.data.length === 0}
        fetching={table.loading}
        facets={table.facets}
        facetsStale={table.facetsStale}
        data={table.data}
        rowCount={table.rowCount}
        getRowId={(row) => row.id}
        columns={columns}
        columnsConfig={columnsConfig}
        className="bg-card"
        externalPagination={table.pagination}
        onExternalPaginationChange={table.setPagination}
        externalSorting={table.sorting}
        onExternalSortingChange={table.setSorting}
        externalColumnFilters={table.filters}
        onExternalColumnFiltersChange={table.setFilters}
        onRowClick={(row) => router.push(`/app/stores/${storeId}/partners/${row.original.id}`)}
        renderCard={renderPartnerCard}
        defaultCardsOnMobile
      />
    </ManagementPageShell>
  );
}
