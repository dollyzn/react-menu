import type { Table } from "@tanstack/react-table";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataTableCardsSortSelectorProps<TData> {
  table: Table<TData>;
}

export default function DataTableCardsSortSelector<TData>({
  table,
}: DataTableCardsSortSelectorProps<TData>) {
  return (
    <Popover modal>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
        <ArrowDownUp />
        Ordenar
        <ChevronsUpDown className="ml-auto opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-0">
        <Command>
          <CommandInput placeholder="Buscar colunas..." />
          <CommandList>
            <CommandEmpty>Nenhuma coluna encontrada.</CommandEmpty>
            <CommandGroup>
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanSort()
                )
                .map((column) => {
                  return (
                    <CommandItem
                      key={column.id}
                      onSelect={() => column.toggleSorting()}
                    >
                      <span className="truncate">
                        {column.columnDef.meta?.name ?? column.id}
                      </span>

                      {column.getIsSorted() === "desc" && (
                        <ArrowDown className="ml-auto size-4 shrink-0" />
                      )}

                      {column.getIsSorted() === "asc" && (
                        <ArrowUp className="ml-auto size-4 shrink-0" />
                      )}
                    </CommandItem>
                  );
                })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
