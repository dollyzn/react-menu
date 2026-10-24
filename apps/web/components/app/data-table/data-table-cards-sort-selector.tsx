import type { RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent } from "@/components/ui/popover";
import type { DataTableInstance } from ".";
import { FilterOptionRow, SEARCH_THRESHOLD, ToolbarTrigger } from "./data-table-filter-parts";

interface DataTableCardsSortSelectorProps<TData extends RowData> {
  table: DataTableInstance<TData>;
}

/** Sorting for the cards view (the table sorts from its headers): a column, then the direction. */
export default function DataTableCardsSortSelector<TData extends RowData>({
  table,
}: DataTableCardsSortSelectorProps<TData>) {
  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanSort());
  const sorted = columns.find((column) => column.getIsSorted());
  const direction = sorted?.getIsSorted();
  const nameOf = (column: (typeof columns)[number]) => column.columnDef.meta?.name ?? column.id;
  const Arrow = direction === "desc" ? ArrowDown : ArrowUp;

  return (
    <Popover modal>
      <ToolbarTrigger
        icon={ArrowDownUp}
        label="Ordenar"
        summary={
          sorted ? (
            <span className="inline-flex items-center gap-1">
              {nameOf(sorted)}
              <Arrow className="size-3" aria-hidden />
            </span>
          ) : undefined
        }
        active={!!sorted}
        ariaLabel={
          sorted ? `Ordenar: ${nameOf(sorted)}, ${direction === "desc" ? "decrescente" : "crescente"}` : "Ordenar"
        }
      />
      <PopoverContent align="end" className="w-auto min-w-60 max-w-80 p-0" sideOffset={8}>
        <Command>
          {columns.length >= SEARCH_THRESHOLD && <CommandInput placeholder="Buscar colunas…" />}
          <CommandList className="max-h-[min(28rem,60vh)]">
            <CommandEmpty>Nenhuma coluna encontrada.</CommandEmpty>
            <CommandGroup heading="Ordenar por">
              {columns.map((column) => (
                <FilterOptionRow
                  key={column.id}
                  value={nameOf(column)}
                  option={{ label: nameOf(column) }}
                  multiple={false}
                  selected={column === sorted}
                  onSelect={() => column.toggleSorting(direction === "desc")}
                />
              ))}
            </CommandGroup>
            {sorted && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Direção">
                  <FilterOptionRow
                    value="__asc__"
                    option={{ label: "Crescente", icon: ArrowUp, description: "A → Z, 0 → 9, antigos primeiro" }}
                    multiple={false}
                    selected={direction === "asc"}
                    onSelect={() => sorted.toggleSorting(false)}
                  />
                  <FilterOptionRow
                    value="__desc__"
                    option={{ label: "Decrescente", icon: ArrowDown, description: "Z → A, 9 → 0, recentes primeiro" }}
                    multiple={false}
                    selected={direction === "desc"}
                    onSelect={() => sorted.toggleSorting(true)}
                  />
                </CommandGroup>
              </>
            )}
          </CommandList>
          {sorted && (
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
              <span>Por {nameOf(sorted).toLowerCase()}</span>
              <Button variant="ghost" size="xs" onClick={() => table.resetSorting(true)}>
                <X /> Limpar
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
