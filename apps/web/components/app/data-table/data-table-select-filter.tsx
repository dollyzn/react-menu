import type { RowData } from "@tanstack/react-table";
import type { Column } from "@/components/app/data-table/features";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent } from "@/components/ui/popover";
import type { FilterGroup, FilterOption } from ".";
import { FilterOptionRow, FilterTrigger, SEARCH_THRESHOLD, flattenOptions } from "./data-table-filter-parts";

interface DataTableSelectFilterProps<TData extends RowData, TValue> {
  column?: Column<TData, TValue>;
  options?: FilterOption[] | FilterGroup[];
  title?: string;
  loading?: boolean;
  grouped?: boolean;
}

/** Single choice filter (radio). Choosing the selected option again clears it. */
export function DataTableSelectFilter<TData extends RowData, TValue>({
  column,
  options,
  title,
  loading,
  grouped,
}: DataTableSelectFilterProps<TData, TValue>) {
  const raw = column?.getFilterValue();
  const selectedValue = raw === undefined || raw === null || raw === "" ? undefined : String(raw);
  const [open, setOpen] = useState(false);
  const defaultApplied = useRef(false);
  const all = flattenOptions(options, grouped);

  useEffect(() => {
    if (defaultApplied.current || !column) return;
    const defaultOption = flattenOptions(options, grouped).find((o) => o?.defaultOption);
    if (!defaultOption) return;
    defaultApplied.current = true;
    if (!column.getFilterValue()) column.setFilterValue(String(defaultOption.value));
  }, [options, grouped, column]);

  const choose = (value: string | undefined) => {
    column?.setFilterValue(value === selectedValue ? undefined : value);
    setOpen(false);
  };

  const columnName = column?.columnDef.meta?.name || title || "";
  const selectedLabel = all.find((o) => String(o.value) === selectedValue)?.label;

  const renderOptions = (list: FilterOption[], prefix = "") =>
    list.map((option) => (
      <FilterOptionRow
        key={String(option.value)}
        value={`${prefix}${option.label} ${option.value}`}
        option={option}
        multiple={false}
        selected={selectedValue === String(option.value)}
        onSelect={() => choose(String(option.value))}
      />
    ));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FilterTrigger label={columnName} active={selectedValue !== undefined} loading={loading} summary={selectedLabel} />
      <PopoverContent className="w-auto min-w-56 max-w-80 p-0" align="start" sideOffset={8}>
        <Command>
          {all.length >= SEARCH_THRESHOLD && <CommandInput placeholder={`Buscar ${columnName.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            {grouped
              ? (options as FilterGroup[])?.map((group, index) => (
                  <CommandGroup key={`${group.group}_${index}`} heading={group.group}>
                    {renderOptions(group.options ?? [], `${group.group} `)}
                  </CommandGroup>
                ))
              : <CommandGroup>{renderOptions((options as FilterOption[]) ?? [])}</CommandGroup>}
          </CommandList>
          {selectedValue !== undefined && (
            <div className="flex justify-end border-t px-3 py-2">
              <Button variant="ghost" size="xs" onClick={() => choose(undefined)}>
                <X /> Limpar
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
