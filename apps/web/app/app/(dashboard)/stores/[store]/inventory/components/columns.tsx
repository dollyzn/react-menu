"use client";

import type { ColumnDef, HeaderContext, Row } from "@/components/app/data-table/features";
import { AlertTriangle, CheckCircle2, History } from "lucide-react";
import type { Ingredient } from "@react-menu/contracts";
import dayjs from "dayjs";
import type { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";
import { cellButtonSize } from "@/components/app/data-table/density";
import { formatQuantity, unitLabels } from "@/utils/units";
import { IngredientMenu, StockMoves } from "./ingredient-actions";
import { IngredientCard, LowStockBadge } from "./ingredient-card";

const header =
  (title: string) =>
  // eslint-disable-next-line react/display-name
  ({ column }: HeaderContext<Ingredient, unknown>) => (
    <DataTableColumnHeader
      titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
      column={column}
      title={title}
    />
  );

export const columns: ColumnDef<Ingredient>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: header("Ingrediente"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <div className="flex min-w-45 items-center gap-3">
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted font-emoji text-lg">
            {row.original.icon ?? "•"}
          </span>
          <span className="font-medium">{row.original.name}</span>
        </div>
      </DataTableColumnCell>
    ),
    meta: { name: "Ingrediente" },
  },
  {
    id: "stockQuantity",
    accessorKey: "stockQuantity",
    header: header("Em estoque"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-semibold tabular-nums">
            {formatQuantity(row.original.stockQuantity, row.original.unit)}
          </span>
          {row.original.isLowStock && <LowStockBadge />}
        </div>
      </DataTableColumnCell>
    ),
    meta: { name: "Em estoque" },
  },
  {
    id: "minStock",
    accessorKey: "minStock",
    header: header("Mínimo"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="tabular-nums text-muted-foreground">
          {formatQuantity(row.original.minStock, row.original.unit)}
        </span>
      </DataTableColumnCell>
    ),
    meta: { name: "Mínimo" },
  },
  {
    id: "unit",
    accessorKey: "unit",
    header: header("Unidade"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="text-muted-foreground">{unitLabels[row.original.unit]}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Unidade" },
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: header("Atualizado em"),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <div className="flex min-w-37.5 items-center text-muted-foreground">
          <History className="mr-2 size-4" />
          {dayjs(row.original.updatedAt).format("DD/MM/YYYY HH:mm")}
        </div>
      </DataTableColumnCell>
    ),
    meta: { name: "Atualizado em" },
  },
  {
    // Filter only: stock status (at/below the minimum or above it).
    id: "stock",
    accessorFn: (ingredient) => (ingredient.isLowStock ? "low" : "ok"),
    enableSorting: false,
    enableHiding: false,
    meta: { name: "Situação", isFilterOnly: true },
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    header: () => <span className="sr-only">Ações</span>,
    cell: ({ row, table }) => {
      const size = cellButtonSize(table.options.meta?.density);
      return (
        <DataTableColumnCell>
          <div className="flex items-center justify-end gap-1">
            <StockMoves ingredient={row.original} size={size} />
            <IngredientMenu ingredient={row.original} size={size === "lg" ? "icon" : "icon-sm"} />
          </div>
        </DataTableColumnCell>
      );
    },
    meta: { name: "Ações" },
  },
];

export const columnsConfig: ColumnsConfig[] = [
  { key: "name", searchable: true },
  {
    key: "stock",
    title: "Situação",
    filterOptions: [
      { label: "Acabando", value: "low", icon: AlertTriangle, iconClassName: "text-warning" },
      { label: "Em dia", value: "ok", icon: CheckCircle2, iconClassName: "text-success" },
    ],
  },
  {
    key: "unit",
    title: "Unidade",
    filterOptions: Object.entries(unitLabels).map(([value, label]) => ({ value, label })),
  },
];

export function renderIngredientCard(row: Row<Ingredient>) {
  return <IngredientCard ingredient={row.original} />;
}
