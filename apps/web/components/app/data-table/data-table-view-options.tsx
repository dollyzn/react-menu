import type { RowData } from "@tanstack/react-table";
import { Columns3, RotateCcw } from "lucide-react";
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

interface DataTableViewOptionsProps<TData extends RowData> {
  table: DataTableInstance<TData>;
}

/** Which columns the table shows (kept per table in localStorage). */
export default function DataTableViewOptions<TData extends RowData>({ table }: DataTableViewOptionsProps<TData>) {
  const columns = table
    .getAllColumns()
    .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide());
  const visible = columns.filter((column) => column.getIsVisible()).length;
  const hidden = columns.length - visible;
  const showAll = () => columns.forEach((column) => column.toggleVisibility(true));

  return (
    <Popover modal>
      <ToolbarTrigger
        icon={Columns3}
        label="Colunas"
        summary={hidden > 0 ? (hidden === 1 ? "1 oculta" : `${hidden} ocultas`) : undefined}
        active={hidden > 0}
        ariaLabel={hidden > 0 ? `Colunas: ${hidden} ocultas` : "Colunas"}
      />
      <PopoverContent align="end" className="w-auto min-w-56 max-w-72 p-0" sideOffset={8}>
        <Command>
          {columns.length >= SEARCH_THRESHOLD && <CommandInput placeholder="Buscar colunas…" />}
          <CommandList className="max-h-[min(28rem,60vh)]">
            <CommandEmpty>Nenhuma coluna encontrada.</CommandEmpty>
            <CommandGroup>
              <FilterOptionRow
                value="__all__"
                option={{ label: "Mostrar todas" }}
                multiple
                selected={hidden === 0}
                indeterminate={hidden > 0 && visible > 0}
                // Only shows: hiding every column would leave an empty table.
                onSelect={showAll}
              />
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Mostrar na tabela">
              {columns.map((column) => {
                const isVisible = column.getIsVisible();
                return (
                  <FilterOptionRow
                    key={column.id}
                    value={column.columnDef.meta?.name ?? column.id}
                    option={{ label: column.columnDef.meta?.name ?? column.id }}
                    multiple
                    selected={isVisible}
                    // Keep at least one column on screen.
                    onSelect={() => (isVisible && visible === 1 ? undefined : column.toggleVisibility(!isVisible))}
                  />
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {visible} de {columns.length} visíveis
            </span>
            {hidden > 0 && (
              <Button variant="ghost" size="xs" onClick={showAll}>
                <RotateCcw /> Restaurar
              </Button>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
