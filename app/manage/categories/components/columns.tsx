"use client";

import { ColumnDef } from "@tanstack/react-table";

import { Calendar, ChevronDown, History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RowActions } from "./table-row-actions";
import { Checkbox } from "@/components/ui/checkbox";

import { formatCurrencyBRL } from "@/utils/string";
import dayjs from "dayjs";

export const columns: ColumnDef<Category>[] = [
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
    id: "items",
    accessorKey: "items",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Itens" />
    ),
    cell: ({ row }) => {
      const items = row.getValue("items") as Item[];
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost">
              {items.length} Itens
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Itens da Categoria {row.getValue("name")}
              </DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{formatCurrencyBRL(item.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      );
    },
    meta: {
      name: "Itens",
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
      pinned: true,
    },
  },
];

export const columnsConfig: ColumnsConfig[] = [
  {
    key: "name",
    searchable: true,
  },
];
