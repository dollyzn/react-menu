"use client";

import { Table } from "@tanstack/react-table";
import { Settings2, X } from "lucide-react";
import { ColumnsConfig } from ".";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DataTableFacetedFilter } from "./data-table-faceted-filter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  columnsConfig?: ColumnsConfig[];
}

export function DataTableToolbar<TData>({
  table,
  columnsConfig,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const searchableColumnConfig = columnsConfig?.find((col) => col.searchable);
  const searchableColumn = searchableColumnConfig
    ? table.getColumn(searchableColumnConfig.key)
    : null;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {searchableColumn && (
          <Input
            placeholder={`Filtrar por ${
              searchableColumn?.columnDef?.meta?.name?.toLowerCase() || ""
            }...`}
            value={(searchableColumn.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              searchableColumn.setFilterValue(event.target.value)
            }
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}

        {columnsConfig?.map(
          (columnConfig) =>
            columnConfig.filterOptions &&
            table.getColumn(columnConfig.key) && (
              <DataTableFacetedFilter
                key={columnConfig.key}
                column={table.getColumn(columnConfig.key)}
                title={
                  table.getColumn(columnConfig.key)?.columnDef.meta?.name || ""
                }
                options={columnConfig.filterOptions}
              />
            )
        )}

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Resetar
            <X />
          </Button>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto hidden h-8 lg:flex"
          >
            <Settings2 />
            Visualização
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[150px]">
          <DropdownMenuLabel>Alternar colunas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {table
            .getAllColumns()
            .filter(
              (column) =>
                typeof column.accessorFn !== "undefined" && column.getCanHide()
            )
            .map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.columnDef.meta?.name}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
