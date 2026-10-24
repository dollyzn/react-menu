"use client";

import { ColumnDef, Row } from "@/components/app/data-table/features";
import dayjs from "dayjs";
import { Calendar } from "lucide-react";
import type { OptionGroup } from "@react-menu/contracts";
import { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";
import { cellButtonSize } from "@/components/app/data-table/density";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyBRL } from "@/utils/string";
import { groupRule } from "./option-group-dialog";
import { RowActions } from "./table-row-actions";
import { OptionGroupCard } from "./option-group-card";

const headerClass = "text-xs uppercase tracking-wider text-muted-foreground";

/** "Mussarela · incluso", "Cheddar · + R$ 2,00" as chips (shared with the card). */
export function OptionChips({ group, max }: { group: OptionGroup; max?: number }) {
  const options = group.options ?? [];
  const shown = max ? options.slice(0, max) : options;
  return (
    <ul aria-label={`Opções de ${group.name}`} className="flex flex-wrap gap-1">
      {shown.map((option) => (
        <li key={option.id} className="rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
          {option.name}{" "}
          <span className="text-muted-foreground">
            {option.price ? `+ ${formatCurrencyBRL(option.price)}` : "incluso"}
          </span>
        </li>
      ))}
      {options.length > shown.length && (
        <li className="px-1 py-0.5 text-xs text-muted-foreground">+{options.length - shown.length}</li>
      )}
    </ul>
  );
}

export const columns: ColumnDef<OptionGroup>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader titleClassName={headerClass} column={column} title="Nome" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="block min-w-37.5 font-medium">{row.original.name}</span>
      </DataTableColumnCell>
    ),
    meta: { name: "Nome" },
  },
  {
    id: "rule",
    header: () => <span className={headerClass}>Regra</span>,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <Badge variant={row.original.minChoices > 0 ? "default" : "secondary"}>{groupRule(row.original)}</Badge>
      </DataTableColumnCell>
    ),
    enableSorting: false,
    meta: { name: "Regra" },
  },
  {
    id: "options",
    header: () => <span className={headerClass}>Opções</span>,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <OptionChips group={row.original} max={4} />
      </DataTableColumnCell>
    ),
    enableSorting: false,
    meta: { name: "Opções" },
  },
  {
    id: "items",
    header: () => <span className={headerClass}>Usado em</span>,
    cell: ({ row }) => {
      const count = row.original.itemsCount ?? 0;
      return (
        <DataTableColumnCell>
          <span className={count ? "" : "text-muted-foreground"}>
            {count === 0 ? "Nenhum item" : count === 1 ? "1 item" : `${count} itens`}
          </span>
        </DataTableColumnCell>
      );
    },
    enableSorting: false,
    meta: { name: "Usado em" },
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: ({ column }) => <DataTableColumnHeader titleClassName={headerClass} column={column} title="Atualizado em" />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="size-3.5" />
          {dayjs(row.original.updatedAt).format("DD/MM/YYYY HH:mm")}
        </span>
      </DataTableColumnCell>
    ),
    meta: { name: "Atualizado em" },
  },
  {
    id: "actions",
    cell: ({ row, table }) => (
      <DataTableColumnCell>
        <RowActions row={row} size={cellButtonSize(table.options.meta?.density)} />
      </DataTableColumnCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
];

export const columnsConfig: ColumnsConfig[] = [{ key: "name", searchable: true }];

export const renderOptionGroupCard = (row: Row<OptionGroup>) => <OptionGroupCard row={row} />;
