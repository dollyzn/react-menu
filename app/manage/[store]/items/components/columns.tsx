"use client";

import { ColumnDef } from "@tanstack/react-table";

import { Calendar, ChevronDown, History, Package } from "lucide-react";

import { ColumnsConfig } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RowActions } from "./table-row-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { HeaderActions } from "./table-header-actions";

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
    id: "addons",
    accessorKey: "addons",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Adicionais" />
    ),
    cell: ({ row }) => {
      const addons = row.getValue("addons") as Item[];
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost">
              {addons.length} Adiciona{addons.length === 1 ? "l" : "is"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionais do Item</DialogTitle>
              <DialogDescription>
                Lista dos adicionais do item {row.getValue("name")}
              </DialogDescription>
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
                {addons.length > 0 ? (
                  addons.map((addon) => (
                    <TableRow key={addon.id}>
                      <TableCell>{addon.name}</TableCell>
                      <TableCell>{addon.description}</TableCell>
                      <TableCell>{formatCurrencyBRL(addon.price)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      <div className="flex flex-col items-center justify-center py-4">
                        <Package className="h-8 w-8 text-muted-foreground mb-2" />
                        <span>
                          Não há adicionais disponíveis para este item
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
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
