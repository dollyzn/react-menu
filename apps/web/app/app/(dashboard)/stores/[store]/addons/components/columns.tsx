"use client";

import { ColumnDef, Row } from "@/components/app/data-table/features";
import { Calendar, History } from "lucide-react";
import { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import { RowActions } from "./table-row-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { HeaderActions } from "./table-header-actions";

import { formatCurrencyBRL } from "@/utils/string";
import dayjs from "dayjs";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";
import { AddonCard } from "./addon-card";

export const columns: ColumnDef<Addon>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Selecionar todos"
        className="translate-y-0.5"
      />
    ),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
          className="translate-y-0.5"
        />
      </DataTableColumnCell>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "name",
    accessorKey: "name",

    header: ({ column }) => (
      <DataTableColumnHeader
        titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
        column={column}
        title="Nome"
      />
    ),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="min-w-37.5 font-medium block">
          {row.getValue("name")}
        </span>
      </DataTableColumnCell>
    ),
    meta: {
      name: "Nome",
    },
  },
  {
    id: "description",
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader
        titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
        column={column}
        title="Descrição"
      />
    ),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <span className="min-w-62.5 max-w-100 truncate font-medium block">
          {row.getValue("description")}
        </span>
      </DataTableColumnCell>
    ),
    meta: {
      name: "Descrição",
    },
  },
  {
    id: "price",
    accessorKey: "price",
    header: ({ column }) => (
      <DataTableColumnHeader
        titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
        column={column}
        title="Preço"
      />
    ),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <div>{formatCurrencyBRL(row.getValue("price"))}</div>
      </DataTableColumnCell>
    ),
    meta: {
      name: "Preço",
    },
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader
        titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
        column={column}
        title="Criado em"
      />
    ),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <div className="flex items-center min-w-41.25">
          {<Calendar className="mr-2 size-4 text-muted-foreground" />}{" "}
          {dayjs(row.getValue("createdAt")).format("DD/MM/YYYY HH:mm")}{" "}
        </div>
      </DataTableColumnCell>
    ),
    meta: {
      name: "Criado em",
    },
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader
        titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
        column={column}
        title="Atualizado em"
      />
    ),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <div className="flex items-center min-w-41.25">
          {<History className="mr-2 size-4 text-muted-foreground" />}
          {dayjs(row.getValue("updatedAt")).format("DD/MM/YYYY HH:mm")}
        </div>
      </DataTableColumnCell>
    ),
    meta: {
      name: "Atualizado em",
    },
  },

  {
    id: "actions",
    header: ({ table }) => <HeaderActions table={table} />,
    cell: ({ row }) => (
      <DataTableColumnCell>
        <RowActions row={row} />
      </DataTableColumnCell>
    ),
    meta: {
      name: "Ações",
    },
  },
];

export function renderAddonCard(row: Row<Addon>) {
  return <AddonCard row={row} />;
}

export const columnsConfig: ColumnsConfig[] = [
  {
    key: "name",
    searchable: true,
  },
];
