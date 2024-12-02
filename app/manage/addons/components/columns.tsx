"use client";

import { ColumnDef } from "@tanstack/react-table";

import { Calendar, History } from "lucide-react";

import { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RowActions } from "./table-row-actions";
import { Checkbox } from "@/components/ui/checkbox";

import { formatCurrencyBRL } from "@/utils/string";
import dayjs from "dayjs";
import { HeaderActions } from "./table-header-actions";

export const columns: ColumnDef<Addon>[] = [
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
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "name",
    accessorKey: "name",

    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Nome" />
    ),
    cell: ({ row }) => (
      <span className="min-w-[150px] font-medium block">
        {row.getValue("name")}
      </span>
    ),
    meta: {
      name: "Nome",
    },
  },
  {
    id: "description",
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Descrição" />
    ),
    cell: ({ row }) => (
      <span className="min-w-[250px] max-w-[400px] truncate font-medium block">
        {row.getValue("description")}
      </span>
    ),
    meta: {
      name: "Descrição",
    },
  },
  {
    id: "price",
    accessorKey: "price",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Preço" />
    ),
    cell: ({ row }) => <div>{formatCurrencyBRL(row.getValue("price"))}</div>,
    meta: {
      name: "Preço",
    },
  },
  {
    id: "createdAt",
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Criado em" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center min-w-[165px]">
        {<Calendar className="mr-2 h-4 w-4 text-muted-foreground" />}
        {dayjs(row.getValue("createdAt")).format("DD/MM/YYYY HH:mm")}
      </div>
    ),
    meta: {
      name: "Criado em",
    },
  },
  {
    id: "updatedAt",
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Atualizado em" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center min-w-[165px]">
        {<History className="mr-2 h-4 w-4 text-muted-foreground" />}
        {dayjs(row.getValue("updatedAt")).format("DD/MM/YYYY HH:mm")}
      </div>
    ),
    meta: {
      name: "Atualizado em",
    },
  },

  {
    id: "actions",
    header: ({ table }) => <HeaderActions table={table} />,
    cell: ({ row }) => <RowActions row={row} />,
    meta: {
      name: "Ações",
    },
  },
];

export const columnsConfig: ColumnsConfig[] = [
  {
    key: "name",
    searchable: true,
  },
];
