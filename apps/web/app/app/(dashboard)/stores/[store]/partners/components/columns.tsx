"use client";

import type { ColumnDef, Row } from "@/components/app/data-table/features";
import { Pause, SmartphoneNfc, Users } from "lucide-react";
import type { PartnerListRow } from "@react-menu/contracts";
import type { ColumnsConfig } from "@/components/data-table";
import { COLUMN_TITLE, DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";
import { cellButtonSize } from "@/components/app/data-table/density";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { commissionRuleLabel } from "@/lib/partner-commission";
import { formatCurrencyBRL } from "@/utils/string";
import { PartnerActions } from "./partner-row-actions";

const orders = (count: number) => (count === 1 ? "1 pedido" : `${count} pedidos`);

/** "Pausado" next to the name: it takes no new sales. */
function PausedBadge() {
  return (
    <Badge variant="outline" className="gap-1 text-warning">
      <Pause /> Pausado
    </Badge>
  );
}

function Machines({ partner }: { partner: PartnerListRow }) {
  return partner.terminals.length ? (
    <span className="inline-flex items-center gap-1.5">
      <SmartphoneNfc className="size-3.5 text-muted-foreground" />
      {partner.terminals.map((terminal) => terminal.name).join(", ")}
    </span>
  ) : (
    <span className="text-muted-foreground">Sem maquininha</span>
  );
}

export const columns: ColumnDef<PartnerListRow>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Parceiro" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="flex min-w-40 items-center gap-2 font-medium">
          {row.original.name}
          {row.original.pausedAt && <PausedBadge />}
        </span>
        <span className="block text-xs text-muted-foreground">
          {commissionRuleLabel({ type: row.original.commissionType, value: row.original.commissionValue })}
        </span>
      </DataTableColumnCell>
    ),
    meta: { name: "Parceiro" },
  },
  {
    id: "sales",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vendas no período" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="block font-medium tabular-nums">{formatCurrencyBRL(row.original.period.sales)}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">{orders(row.original.period.orders)}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Vendas no período" },
  },
  {
    id: "commission",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Comissão no período" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="tabular-nums">{formatCurrencyBRL(row.original.period.commission)}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Comissão no período" },
  },
  {
    id: "toPay",
    header: ({ column }) => <DataTableColumnHeader column={column} title="A pagar" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className={row.original.toPay.amount ? "font-semibold text-success tabular-nums" : "text-muted-foreground tabular-nums"}>
          {formatCurrencyBRL(row.original.toPay.amount)}
        </span>
      </DataTableColumnCell>
    ),
    meta: { name: "A pagar" },
  },
  {
    id: "terminals",
    header: () => <span className={COLUMN_TITLE}>Maquininha</span>,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <Machines partner={row.original} />
      </DataTableColumnCell>
    ),
    enableSorting: false,
    meta: { name: "Maquininha" },
  },
  {
    id: "members",
    header: () => <span className={COLUMN_TITLE}>Pessoas</span>,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Users className="size-3.5 text-muted-foreground" /> {row.original.membersCount}
        </span>
      </DataTableColumnCell>
    ),
    enableSorting: false,
    meta: { name: "Pessoas" },
  },
  // Filters only: the period of the sales columns, and selling or paused.
  {
    id: "createdAt",
    accessorFn: () => null,
    enableSorting: false,
    enableHiding: false,
    meta: { name: "Período", isFilterOnly: true },
  },
  {
    id: "status",
    accessorFn: (partner) => (partner.pausedAt ? "paused" : "active"),
    enableSorting: false,
    enableHiding: false,
    meta: { name: "Situação", isFilterOnly: true },
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Ações</span>,
    cell: ({ row, table }) => (
      <DataTableColumnCell>
        <PartnerActions partner={row.original} size={cellButtonSize(table.options.meta?.density)} />
      </DataTableColumnCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
];

export const columnsConfig: ColumnsConfig[] = [
  { key: "name", searchable: true },
  { key: "createdAt", type: "date-range", title: "Período" },
  {
    key: "status",
    title: "Situação",
    filterOptions: [
      { label: "Vendendo", value: "active" },
      { label: "Pausado", value: "paused" },
    ],
  },
];

/** A partner on phones (the table's renderCard). */
function PartnerCard({ row }: { row: Row<PartnerListRow> }) {
  const partner = row.original;
  return (
    <Card className="gap-2 border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="flex items-center gap-2 leading-tight font-semibold">
            {partner.name}
            {partner.pausedAt && <PausedBadge />}
          </h3>
          <p className="text-xs text-muted-foreground">
            {commissionRuleLabel({ type: partner.commissionType, value: partner.commissionValue })}
          </p>
        </div>
        <PartnerActions partner={partner} size="icon-xs" />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Vendas</dt>
          <dd className="font-medium tabular-nums">{formatCurrencyBRL(partner.period.sales)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Comissão</dt>
          <dd className="tabular-nums">{formatCurrencyBRL(partner.period.commission)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">A pagar</dt>
          <dd className="font-semibold text-success tabular-nums">{formatCurrencyBRL(partner.toPay.amount)}</dd>
        </div>
      </dl>
      <Separator className="my-0.5" />
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Machines partner={partner} />
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-3.5" /> {partner.membersCount} {partner.membersCount === 1 ? "pessoa" : "pessoas"}
        </span>
      </p>
    </Card>
  );
}

export const renderPartnerCard = (row: Row<PartnerListRow>) => <PartnerCard row={row} />;
