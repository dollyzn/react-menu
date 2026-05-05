"use client";

import { ColumnDef } from "@tanstack/react-table";

import { Calendar, History } from "lucide-react";

import { DataTableColumnHeader } from "@/components/app/data-table/data-table-column-header";
import { RowActions } from "./table-row-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { HeaderActions } from "./table-header-actions";
import { AddonsColumnDialog } from "./addons-column-dialog";
import { Badge } from "@/components/ui/badge";

import { formatCurrencyBRL } from "@/utils/string";
import dayjs from "dayjs";
import DataTableColumnCell from "@/components/app/data-table/data-table-column-cell";

export const columns: ColumnDef<Item>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <DataTableColumnCell>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
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
        <span className="min-w-[150px] font-medium block">
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
        <span className="min-w-[250px] max-w-[400px] truncate font-medium block">
          {row.getValue("description") || "-"}
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
    id: "category.name",
    accessorKey: "category.name",
    header: ({ column }) => (
      <DataTableColumnHeader
        titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
        column={column}
        title="Categoria"
      />
    ),
    cell: ({ row }) => {
      return (
        <DataTableColumnCell>
          <Badge variant="outline">{row.getValue("category.name")}</Badge>
        </DataTableColumnCell>
      );
    },
    meta: {
      name: "Categoria",
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    id: "addonsCount",
    accessorKey: "addonsCount",
    header: ({ column }) => (
      <DataTableColumnHeader
        titleClassName="text-xs uppercase tracking-wider text-muted-foreground"
        column={column}
        title="Adicionais"
      />
    ),
    cell: ({ row }) => {
      return (
        <DataTableColumnCell>
          <AddonsColumnDialog row={row} />
        </DataTableColumnCell>
      );
    },
    meta: {
      name: "Adicionais",
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
        <div className="flex items-center min-w-[165px]">
          {<Calendar className="mr-2 h-4 w-4 text-muted-foreground" />}
          {dayjs(row.getValue("createdAt")).format("DD/MM/YYYY HH:mm")}
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
        <div className="flex items-center min-w-[165px]">
          {<History className="mr-2 h-4 w-4 text-muted-foreground" />}
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
