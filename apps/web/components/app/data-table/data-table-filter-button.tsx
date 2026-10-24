import type { RowData } from "@tanstack/react-table";
import type { Column } from "@/components/app/data-table/features";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { FilterTrigger } from "./data-table-filter-parts";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface DataTableFilterButtonProps<TData extends RowData, TValue> {
  column: Column<TData, TValue>;
  placeholder?: string;
}

export function DataTableFilterButton<TData extends RowData, TValue>({
  column,
  placeholder,
}: DataTableFilterButtonProps<TData, TValue>) {
  const columnName = column.columnDef.meta?.name || "";
  const [filterValue, setFilterValue] = useState<string>(
    (column.getFilterValue() as string) || ""
  );
  const [open, setOpen] = useState(false);
  const currentFilterValue = (column.getFilterValue() as string) || "";

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (open) {
      setFilterValue(currentFilterValue);
      return;
    }
    if (!open && filterValue !== column.getFilterValue()) {
      column.setFilterValue(filterValue || undefined);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      column.setFilterValue(filterValue || undefined);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const clearFilter = () => {
    setFilterValue("");
    column.setFilterValue(undefined);
  };

  const applyFilter = () => {
    column.setFilterValue(filterValue || undefined);
    setOpen(false);
  };

  const hasFilter = !!currentFilterValue;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <FilterTrigger label={columnName} active={hasFilter} summary={currentFilterValue} />
      <PopoverContent className="w-62.5 p-3" align="start" sideOffset={8}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="font-medium text-sm">
              Filtrar por {columnName.toLowerCase()}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder={placeholder || `Digite para filtrar...`}
                value={filterValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="h-9 pl-8 pr-8 bg-background"
                autoFocus
              />
              {filterValue && (
                <X
                  className="absolute right-2 top-2.5 size-4 text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => setFilterValue("")}
                />
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilter}
              className="text-xs h-8"
              disabled={!hasFilter && !filterValue}
            >
              Limpar
            </Button>
            <Button size="sm" onClick={applyFilter} className="text-xs h-8">
              Aplicar filtro
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
