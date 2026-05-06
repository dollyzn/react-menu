import type { Column } from "@tanstack/react-table";
import { FilterIcon as Funnel, X, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface DataTableFilterButtonProps<TData, TValue> {
  column: Column<TData, TValue>;
  placeholder?: string;
}

export function DataTableFilterButton<TData, TValue>({
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
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 border-dashed"
            aria-label={`Filtrar por ${columnName.toLowerCase()}`}
          />
        }
      >
        <Funnel />
        <span className="capitalize">{columnName}</span>
        {hasFilter && (
          <>
            <Separator orientation="vertical" className="mx-1 my-auto h-4" />
            <Badge
              variant="secondary"
              className="max-w-[80px] rounded-sm px-1 font-normal"
            >
              <div className="truncate">{currentFilterValue}</div>
            </Badge>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-3" align="start" sideOffset={8}>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="font-medium text-sm">
              Filtrar por {columnName.toLowerCase()}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
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
                  className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
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
