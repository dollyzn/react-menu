import type { RowData } from "@tanstack/react-table";
import type { Column } from "@/components/app/data-table/features";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
import type { FilterGroup, FilterOption } from ".";
import { FilterOptionRow, FilterTrigger, SEARCH_THRESHOLD, flattenOptions } from "./data-table-filter-parts";

interface DataTableFacetedFilterProps<TData extends RowData, TValue> {
  column?: Column<TData, TValue>;
  options?: FilterOption[] | FilterGroup[];
  title?: string;
  loading?: boolean;
  grouped?: boolean;
}

/** Multiple choice filter (checkboxes). The column filter is the source of truth. */
export function DataTableFacetedFilter<TData extends RowData, TValue>({
  column,
  options,
  title,
  loading,
  grouped,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const filterValue = column?.getFilterValue();
  const selectedValues = new Set<string>(
    filterValue ? (Array.isArray(filterValue) ? filterValue : [filterValue]).map(String) : []
  );
  const [open, setOpen] = useState(false);
  const defaultApplied = useRef(false);
  const all = flattenOptions(options, grouped);

  // Apply the options' defaults once, as soon as options are available.
  useEffect(() => {
    if (defaultApplied.current || !column) return;
    const defaults = flattenOptions(options, grouped).filter((o) => o?.defaultOption);
    if (defaults.length === 0) return;
    defaultApplied.current = true;
    if (!column.getFilterValue()) column.setFilterValue(defaults.map((o) => String(o.value)));
  }, [options, grouped, column]);

  const setSelection = (values: Set<string>) =>
    column?.setFilterValue(values.size ? Array.from(values) : undefined);

  const toggle = (value: string) => {
    const next = new Set(selectedValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSelection(next);
  };

  const columnName = column?.columnDef.meta?.name || title || "";
  const count = selectedValues.size;
  const allSelected = all.length > 0 && count === all.length;
  const labelOf = (value: string) => all.find((o) => String(o.value) === value)?.label ?? value;
  const summary = count === 0 ? undefined : count <= 2 ? [...selectedValues].map(labelOf).join(", ") : `${count} selecionados`;

  const renderOptions = (list: FilterOption[], prefix = "") =>
    list.map((option) => (
      <FilterOptionRow
        key={String(option.value)}
        value={`${prefix}${option.label} ${option.value}`}
        option={option}
        multiple
        selected={selectedValues.has(String(option.value))}
        onSelect={() => toggle(String(option.value))}
      />
    ));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <FilterTrigger label={columnName} active={count > 0} loading={loading} summary={summary} />
      <PopoverContent className="w-auto min-w-56 max-w-80 p-0" align="start" sideOffset={8}>
        <Command>
          {all.length >= SEARCH_THRESHOLD && <CommandInput placeholder={`Buscar ${columnName.toLowerCase()}…`} />}
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            {all.length > 1 && (
              <>
                <CommandGroup>
                  <FilterOptionRow
                    value="__all__"
                    option={{ label: "Selecionar todos" }}
                    multiple
                    selected={allSelected}
                    indeterminate={count > 0 && !allSelected}
                    onSelect={() => setSelection(allSelected ? new Set() : new Set(all.map((o) => String(o.value))))}
                  />
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {grouped
              ? (options as FilterGroup[])?.map((group, index) => (
                  <CommandGroup key={`${group.group}_${index}`} heading={group.group}>
                    {renderOptions(group.options ?? [], `${group.group} `)}
                  </CommandGroup>
                ))
              : <CommandGroup>{renderOptions((options as FilterOption[]) ?? [])}</CommandGroup>}
          </CommandList>
          {count > 0 && (
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {count} {count === 1 ? "selecionado" : "selecionados"}
              </span>
              <Button variant="ghost" size="xs" onClick={() => setSelection(new Set())}>
                <X /> Limpar
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
