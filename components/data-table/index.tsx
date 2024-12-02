"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";
import { AlertCircle, Search } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface FilterOptions {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface ColumnsConfig {
  key: string;
  searchable?: boolean;
  filterOptions?: FilterOptions[];
}

interface DataTableProps<TData, TValue> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  columnsConfig?: ColumnsConfig[];
}

export function DataTable<TData, TValue>({
  data,
  columns,
  columnsConfig,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} columnsConfig={columnsConfig} />

      <ScrollArea className="rounded-md border mt-3 overflow-visible">
        <ScrollBar orientation="horizontal" style={{ top: "-13px" }} />

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getCoreRowModel().rows.length > 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-52 text-center"
                >
                  <div className="max-w-[400px] mx-auto">
                    <Search size={35} className="mx-auto mb-2" />
                    <p className="text-lg font-semibold">
                      Nenhum resultado encontrado
                    </p>
                    <p className="text-sm">
                      Não encontramos registros que correspondam aos filtros
                      aplicados. Tente alterar os filtros ou redefini-los.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-52 text-center"
                >
                  <div className="max-w-[400px] mx-auto">
                    <AlertCircle size={35} className="mx-auto mb-2" />
                    <p className="text-lg font-semibold">
                      Nenhum registro encontrado
                    </p>
                    <p className="text-sm">
                      Parece que ainda não há nenhum registro criado no sistema.
                      Por favor, verifique novamente mais tarde.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <ScrollBar orientation="horizontal" style={{ bottom: "-12px" }} />
      </ScrollArea>
      <DataTablePagination table={table} />
    </div>
  );
}
