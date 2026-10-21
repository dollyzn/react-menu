"use client";

import type { ColumnDef, HeaderContext, Row } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import type { Order } from "@react-menu/contracts";
import { ColumnsConfig, DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";
import { useTableQuery } from "@/hooks/use-table-query";
import { useGetOrdersPageQuery } from "@/redux/features/order/orderApi";
import type { StoreScopedListArg } from "@/redux/api/listQueryParams";
import type { PaginatedList } from "@/types/paginated-list";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";
import { cn } from "@/lib/utils";
import { CHANNEL, PAYMENT, STATUS, toOptions } from "./order-labels";

const header =
  (title: string) =>
  // eslint-disable-next-line react/display-name
  ({ column }: HeaderContext<Order, unknown>) => (
    <DataTableColumnHeader titleClassName="text-xs uppercase tracking-wider text-muted-foreground" column={column} title={title} />
  );

const itemsSummary = (order: Order) => order.items.map((line) => `${line.quantity}× ${line.name}`).join(", ");

const columns: ColumnDef<Order>[] = [
  {
    id: "number",
    accessorKey: "number",
    header: header("Pedido"),
    enableSorting: false,
    cell: ({ row }) => <DataTableColumnCell><span className="font-black tabular-nums">#{row.original.number}</span></DataTableColumnCell>,
    meta: { name: "Pedido" },
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: header("Data"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="tabular-nums whitespace-nowrap">{format(parseISO(row.original.createdAt), "dd/MM/yy HH:mm")}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Data" },
  },
  {
    id: "customerName",
    accessorKey: "customerName",
    header: header("Cliente"),
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="block font-medium">{row.original.customerName}</span>
        {row.original.customerPhone && (
          <span className="block text-xs text-muted-foreground">{formatPhoneBR(row.original.customerPhone.replace(/^55/, ""))}</span>
        )}
      </DataTableColumnCell>
    ),
    meta: { name: "Número, cliente ou telefone" },
  },
  {
    id: "items",
    header: header("Itens"),
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="block max-w-[280px] truncate text-muted-foreground">{itemsSummary(row.original)}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Itens" },
  },
  {
    id: "channel",
    accessorKey: "channel",
    header: header("Canal"),
    enableSorting: false,
    cell: ({ row }) => {
      const channel = CHANNEL[row.original.channel];
      return (
        <DataTableColumnCell>
          <span className="inline-flex items-center gap-1 text-sm">
            <channel.icon className="size-3.5" /> {channel.label}
          </span>
        </DataTableColumnCell>
      );
    },
    meta: { name: "Canal" },
  },
  {
    id: "paymentMethod",
    accessorKey: "paymentMethod",
    header: header("Pagamento"),
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="block text-sm">{PAYMENT[row.original.paymentMethod]}</span>
        <span className={cn("block text-xs", row.original.paymentStatus === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          {row.original.paymentStatus === "paid" ? "Pago" : "Não pago"}
        </span>
      </DataTableColumnCell>
    ),
    meta: { name: "Pagamento" },
  },
  {
    id: "total",
    accessorKey: "total",
    header: header("Total"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="font-semibold tabular-nums">{formatCurrencyBRL(row.original.total)}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Total" },
  },
  {
    id: "status",
    accessorKey: "status",
    header: header("Status"),
    enableSorting: false,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", STATUS[row.original.status].tone)}>
          {STATUS[row.original.status].label}
        </span>
      </DataTableColumnCell>
    ),
    meta: { name: "Status" },
  },
];

const columnsConfig: ColumnsConfig[] = [
  { key: "customerName", searchable: true },
  { key: "createdAt", type: "date-range", title: "Período" },
  { key: "status", filterOptions: toOptions(STATUS) },
  { key: "channel", filterOptions: toOptions(CHANNEL) },
  { key: "paymentMethod", filterOptions: toOptions(PAYMENT) },
];

/** Every order of the store, any period: search, filters and pagination in the URL. */
export function OrderHistory({ storeId, onOpen }: { storeId: string; onOpen: (orderId: string) => void }) {
  const table = useTableQuery<Order, PaginatedList<Order>, StoreScopedListArg>(
    useGetOrdersPageQuery,
    ({ filterParam, sortingParam, paginationParam }) => ({
      storeId,
      filters: filterParam as StoreScopedListArg["filters"],
      sort: sortingParam,
      pagination: paginationParam,
    }),
    { initialSorting: [{ id: "createdAt", desc: true }], initialPagination: { pageIndex: 0, pageSize: 20 } }
  );

  const renderCard = (row: Row<Order>) => {
    const order = row.original;
    return (
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        aria-label={`Pedido ${order.number} de ${order.customerName}`}
        className="w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xl font-black tabular-nums">#{order.number}</p>
            <p className="text-sm font-medium">{order.customerName}</p>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[order.status].tone)}>
            {STATUS[order.status].label}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{itemsSummary(order)}</p>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted-foreground tabular-nums">{format(parseISO(order.createdAt), "dd/MM HH:mm")}</span>
          <span className="font-semibold tabular-nums">{formatCurrencyBRL(order.total)}</span>
        </div>
      </button>
    );
  };

  return (
    <DataTable<Order, unknown>
      tableId={`orders-history-${storeId}`}
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
      onRowClick={(row) => onOpen(row.original.id)}
      renderCard={renderCard}
      defaultCardsOnMobile
    />
  );
}
