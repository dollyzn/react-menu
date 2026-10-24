"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import type { OptionGroup } from "@react-menu/contracts";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useTableQuery } from "@/hooks/use-table-query";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import { useGetOptionGroupsQuery } from "@/redux/features/option-group/optionGroupApi";
import type { PaginatedList } from "@/types/paginated-list";
import { ManagementPageShell } from "../components/management-page-shell";
import { columns, columnsConfig, renderOptionGroupCard } from "./components/columns";
import { OptionGroupDialog } from "./components/option-group-dialog";

/** Choice groups ("Escolha o queijo"): created here, attached on each item. */
export default function OptionGroupsPage() {
  const { store } = useParams<{ store: string }>();
  const [creating, setCreating] = useState(false);

  const table = useTableQuery<OptionGroup, PaginatedList<OptionGroup>, StoreScopedListArg>(
    useGetOptionGroupsQuery,
    ({ filterParam, sortingParam, paginationParam }) => ({
      storeId: store,
      filters: filterParam as Record<string, string | string[] | null | undefined>,
      sort: sortingParam,
      pagination: paginationParam,
    })
  );

  return (
    <ManagementPageShell
      storeId={store}
      pageLabel="Grupos de escolha"
      description="Escolhas que o cliente faz ao pedir, como o queijo do pastel ou até 2 molhos. Depois, ligue o grupo nos itens."
      action={
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus /> Criar grupo
        </Button>
      }
    >
      <DataTable
        tableId={`option-groups-${store}`}
        loading={table.loading}
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
        renderCard={renderOptionGroupCard}
        defaultCardsOnMobile
      />
      <OptionGroupDialog storeId={store} group={null} open={creating} onOpenChange={setCreating} />
    </ManagementPageShell>
  );
}
