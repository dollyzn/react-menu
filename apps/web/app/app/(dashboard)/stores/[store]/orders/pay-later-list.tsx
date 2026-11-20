"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HandCoins, ReceiptText, Users } from "lucide-react";
import type { PayLaterOrder } from "@react-menu/contracts";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQueryParam } from "@/hooks/use-query-param";
import { useTableQuery } from "@/hooks/use-table-query";
import { useLastValue } from "@/hooks/use-last-value";
import { useGetPayLaterOrdersQuery, useGetPayLaterSummaryQuery } from "@/redux/features/order/orderApi";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";
import { formatCurrencyBRL } from "@/utils/string";
import { ReceivePayment } from "./receive-payment";
import { PayLaterCustomers } from "./pay-later-customers";
import {
  PayLaterActionsContext,
  payLaterColumns,
  payLaterColumnsConfig,
  renderPayLaterCard,
} from "./pay-later-columns";

/**
 * Managers: orders sent as "pagar depois" (fiado) and not paid yet, any day.
 * By customer (default): what each one owes, to receive all of it or the
 * orders ticked at once. By order: the store's DataTable with search, sort
 * and pages on the API and in the URL, like the history. Above both, what is
 * open, from how many and since when.
 */
export function PayLaterList({ storeId }: { storeId: string }) {
  const [list, setList] = useQueryParam("lista");
  const byOrder = list === "pedidos";
  const { data: summary, isError, refetch } = useGetPayLaterSummaryQuery(storeId);

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
        <section
          aria-label="Resumo do que está em aberto"
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HandCoins className="size-5" />
            </span>
            <div>
              <p className="text-3xl leading-none font-black tabular-nums">{formatCurrencyBRL(summary.total)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                em aberto · {summary.count} {summary.count === 1 ? "pedido" : "pedidos"} de {summary.customers}{" "}
                {summary.customers === 1 ? "cliente" : "clientes"}
                {summary.since &&
                  ` · o mais antigo há ${formatDistanceToNowStrict(parseISO(summary.since), { locale: ptBR })}`}
              </p>
            </div>
          </div>
          <ToggleGroup
            aria-label="Ver por"
            value={[byOrder ? "pedidos" : "clientes"]}
            onValueChange={(value) =>
              value[0] &&
              // The order list's table params (page, search) go with it.
              setList(value[0] === "pedidos" ? "pedidos" : null, (params) => {
                if (value[0] !== "pedidos")
                  for (const key of [...params.keys()]) if (!["view", "lista"].includes(key)) params.delete(key);
              })
            }
            variant="outline"
            className="self-start sm:self-center"
          >
            <ToggleGroupItem value="clientes" aria-label="Por cliente">
              <Users /> Por cliente
            </ToggleGroupItem>
            <ToggleGroupItem value="pedidos" aria-label="Por pedido">
              <ReceiptText /> Por pedido
            </ToggleGroupItem>
          </ToggleGroup>
        </section>
      )}

      {byOrder ? <PayLaterOrders storeId={storeId} /> : <PayLaterCustomers storeId={storeId} />}
    </div>
  );
}

/** Every open order, one by one: the store's DataTable (cards by default). */
function PayLaterOrders({ storeId }: { storeId: string }) {
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
  const [receiving, setReceiving] = useState<PayLaterOrder | null>(null);
  const shown = useLastValue(receiving);
  const actions = useMemo(() => ({ receive: (order: PayLaterOrder) => setReceiving(order) }), []);

  return (
    <div className="flex flex-col gap-4">
      <PayLaterActionsContext.Provider value={actions}>
        <DataTable<PayLaterOrder>
          maxPageSize={100}
          tableId={`orders-pay-later-${storeId}`}
          loading={table.loading && table.data.length === 0}
          fetching={table.loading}
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
