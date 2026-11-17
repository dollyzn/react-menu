"use client";

import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import type { PayLaterOrder } from "@react-menu/contracts";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useTableQuery } from "@/hooks/use-table-query";
import { useLastValue } from "@/hooks/use-last-value";
import { useGetPayLaterOrdersQuery, useGetPayLaterSummaryQuery } from "@/redux/features/order/orderApi";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";
import { formatCurrencyBRL } from "@/utils/string";
import { ReceivePayment } from "./receive-payment";
import {
  PayLaterActionsContext,
  payLaterColumns,
  payLaterColumnsConfig,
  renderPayLaterCard,
} from "./pay-later-columns";

/**
 * Managers: orders sent as "pagar depois" (fiado) and not paid yet, any day.
 * The store's DataTable (cards by default) with search, sort and pages on the
 * API and in the URL, like the history; above it, what is open and who owes
 * the most. "Receber" records the payment and the order leaves the list.
 */
export function PayLaterList({ storeId }: { storeId: string }) {
  const table = useTableQuery<PayLaterOrder, PaginatedList<PayLaterOrder>, StoreScopedListArg>(
    useGetPayLaterOrdersQuery,
    ({ filterParam, sortingParam, paginationParam }) => ({
      storeId,
      filters: filterParam as StoreScopedListArg["filters"],
      sort: sortingParam,
      pagination: paginationParam,
    }),
    { initialSorting: [{ id: "createdAt", desc: false }], initialPagination: { pageIndex: 0, pageSize: 20 } }
  );
  const { data: summary, isError, refetch } = useGetPayLaterSummaryQuery(storeId);
  const [receiving, setReceiving] = useState<PayLaterOrder | null>(null);
  const shown = useLastValue(receiving);
  const actions = useMemo(() => ({ receive: (order: PayLaterOrder) => setReceiving(order) }), []);

  // Never "ninguém devendo" when it couldn't be read.
  if (isError && !summary) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar os pedidos para pagar depois.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (summary?.count === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        <HandCoins className="size-10 opacity-40" />
        <p className="text-sm">Ninguém devendo. Pedidos enviados como “Pagar depois” aparecem aqui até serem pagos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <section aria-label="Resumo do que está em aberto" className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            <span className="text-2xl font-black text-foreground tabular-nums">{formatCurrencyBRL(summary.total)}</span> em
            aberto · {summary.count} {summary.count === 1 ? "pedido" : "pedidos"}
          </p>
          {/* Who owes the most: the counter charges them first. */}
          <ul aria-label="Quanto cada cliente deve" className="flex flex-wrap gap-1.5">
            {summary.debtors.map((debtor) => (
              <li
                key={debtor.phone ?? debtor.name}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs"
              >
                <span className="max-w-40 truncate font-medium">{debtor.name}</span>
                <span className="font-semibold text-primary tabular-nums">{formatCurrencyBRL(debtor.due)}</span>
                {debtor.orders > 1 && <span className="text-muted-foreground">· {debtor.orders} pedidos</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <PayLaterActionsContext.Provider value={actions}>
        <DataTable<PayLaterOrder>
          maxPageSize={100}
          tableId={`orders-pay-later-${storeId}`}
          loading={table.loading && table.data.length === 0}
          data={table.data}
          rowCount={table.rowCount}
          columns={payLaterColumns}
          columnsConfig={payLaterColumnsConfig}
          getRowId={(order) => order.id}
          className="bg-card"
          externalPagination={table.pagination}
          onExternalPaginationChange={table.setPagination}
          externalSorting={table.sorting}
          onExternalSortingChange={table.setSorting}
          externalColumnFilters={table.filters}
          onExternalColumnFiltersChange={table.setFilters}
          renderCard={renderPayLaterCard}
          defaultViewMode="cards"
          cardsContainerClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        />
      </PayLaterActionsContext.Provider>

      {shown && (
        <ReceivePayment order={shown} storeId={storeId} open={receiving !== null} onClose={() => setReceiving(null)} />
      )}
    </div>
  );
}
