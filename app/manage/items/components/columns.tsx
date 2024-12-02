"use client";

import { ColumnDef } from "@tanstack/react-table";

import { Calendar, History } from "lucide-react";

import { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RowActions } from "./table-row-actions";
import { Checkbox } from "@/components/ui/checkbox";

import { formatCurrencyBRL } from "@/utils/string";
import { Badge } from "@/components/ui/badge";
import items from "../items.json";
import dayjs from "dayjs";

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
    id: "category.name",
    accessorKey: "category.name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Categoria" />
    ),
    cell: ({ row }) => {
      return <Badge variant="outline">{row.getValue("category.name")}</Badge>;
    },
    meta: {
      name: "Categoria",
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
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
    cell: ({ row, table }) => <RowActions row={row} table={table} />,
    meta: {
      name: "Ações",
    },
  },
];

const categories = new Set(items.map(({ category }) => category.name));

export const columnsConfig: ColumnsConfig[] = [
  {
    key: "name",
    searchable: true,
  },
  {
    key: "category.name",
    filterOptions: Array.from(categories).map((category) => ({
      value: category,
      label: category,
    })),
  },
];
