"use client";

import { format, parseISO } from "date-fns";
import type { ColumnDef, Row } from "@/components/app/data-table/features";
import type { PartnerSaleRow, PartnerSettlementState } from "@react-menu/contracts";
import type { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/utils/string";

/** Where a sale's commission is (the "Comissão" filter and the badge). */
export const SETTLEMENT: Record<PartnerSettlementState, { label: string; className: string }> = {
  to_pay: { label: "A pagar", className: "bg-success/10 text-success" },
  in_store: { label: "Ainda na loja", className: "bg-muted text-muted-foreground" },
  paid: { label: "Paga", className: "border-border bg-transparent text-muted-foreground" },
};

const payable = (row: Row<PartnerSaleRow>) => row.original.settlement === "to_pay";

function SettlementBadge({ sale }: { sale: PartnerSaleRow }) {
  const state = SETTLEMENT[sale.settlement];
  return (
    <Badge variant="outline" className={state.className}>
      {state.label}
      {sale.settledAt && ` em ${format(parseISO(sale.settledAt), "dd/MM")}`}
    </Badge>
  );
}

/** Handed over and to the customer, as the partner followed it. */
const stage = (sale: PartnerSaleRow) =>
  sale.partnerDeliveredAt ? "Entregue ao cliente" : sale.completedAt ? "Com o parceiro" : "Na loja";

export const salesColumns: ColumnDef<PartnerSaleRow>[] = [
  {
    id: "select",
    // Only sales with commission to pay can be picked.
    header: ({ table }) => {
      const rows = table.getRowModel().rows.filter(payable);
      const picked = rows.filter((row) => row.getIsSelected()).length;
      return (
        <Checkbox
          checked={rows.length > 0 && picked === rows.length}
          indeterminate={picked > 0 && picked < rows.length}
          disabled={rows.length === 0}
          onCheckedChange={(value) => rows.forEach((row) => row.toggleSelected(Boolean(value)))}
          aria-label="Escolher as vendas a pagar desta página"
          className="translate-y-0.5"
        />
      );
    },
    cell: ({ row }) => (
      <DataTableColumnCell>
        <Checkbox
          checked={row.getIsSelected()}
          disabled={!payable(row)}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          aria-label={`Escolher o pedido ${row.original.number}`}
          className="translate-y-0.5"
        />
      </DataTableColumnCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "customerName",
    accessorKey: "customerName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Pedido" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="block font-medium">
          <span className="font-black tabular-nums">#{row.original.number}</span> · {row.original.customerName}
        </span>
        <span className="block text-xs text-muted-foreground">{stage(row.original)}</span>
      </DataTableColumnCell>
    ),
    enableSorting: false,
    meta: { name: "Número ou cliente" },
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Data" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="whitespace-nowrap tabular-nums">{format(parseISO(row.original.createdAt), "dd/MM/yy HH:mm")}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Data" },
  },
  {
    id: "total",
    accessorKey: "total",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Venda" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="tabular-nums">{formatCurrencyBRL(row.original.total)}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Venda" },
  },
  {
    id: "commissionAmount",
    accessorKey: "commissionAmount",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Comissão" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className={cn("font-semibold tabular-nums", row.original.settlement === "paid" && "text-muted-foreground")}>
          {formatCurrencyBRL(row.original.commissionAmount)}
        </span>
      </DataTableColumnCell>
    ),
    meta: { name: "Comissão" },
  },
  {
    id: "settlement",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Situação" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <SettlementBadge sale={row.original} />
      </DataTableColumnCell>
    ),
    enableSorting: false,
    meta: { name: "Situação" },
  },
];

export const salesColumnsConfig: ColumnsConfig[] = [
  { key: "customerName", searchable: true },
  { key: "createdAt", type: "date-range", title: "Período" },
  {
    key: "settlement",
    title: "Comissão",
    filterOptions: (Object.keys(SETTLEMENT) as PartnerSettlementState[]).map((value) => ({
      label: SETTLEMENT[value].label,
      value,
    })),
  },
];

/** A sale on phones: the commission and where it is; a tap picks one to pay. */
function SaleCard({ row }: { row: Row<PartnerSaleRow> }) {
  const sale = row.original;
  return (
    <Card className={cn("gap-1.5 border-border bg-card p-3 shadow-sm", row.getIsSelected() && "border-primary bg-primary/5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="font-black tabular-nums">#{sale.number}</span> · {sale.customerName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {format(parseISO(sale.createdAt), "dd/MM/yy HH:mm")} · {stage(sale)}
          </p>
        </div>
        {payable(row) && (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label={`Escolher o pedido ${sale.number}`}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground tabular-nums">Venda {formatCurrencyBRL(sale.total)}</span>
        <span className="flex items-center gap-2">
          <SettlementBadge sale={sale} />
          <span className="font-semibold tabular-nums">{formatCurrencyBRL(sale.commissionAmount)}</span>
        </span>
      </div>
    </Card>
  );
}

export const renderSaleCard = (row: Row<PartnerSaleRow>) => <SaleCard row={row} />;
