import type { Column } from "@tanstack/react-table";
import { Check, ListFilter, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { FilterGroup, FilterOption } from ".";
import { useState, useEffect, useRef } from "react";

interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  options?: FilterOption[] | FilterGroup[];
  title?: string;
  loading?: boolean;
  grouped?: boolean;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  options,
  title,
  loading,
  grouped,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const getInitialSelectedValues = () => {
    const filterValue = column?.getFilterValue();
    if (!filterValue) return new Set<string>();
    return new Set(Array.isArray(filterValue) ? filterValue : [filterValue]);
  };

  const [selectedValues, setSelectedValues] = useState<Set<string>>(
    getInitialSelectedValues
  );
  const [open, setOpen] = useState(false);

  const defaultSetted = useRef(false);

  useEffect(() => {
    const defaultOptions = findDefaultOptions();
    if (
      defaultOptions.length > 0 &&
      selectedValues.size === 0 &&
      !defaultSetted.current
    ) {
      const stringValues = defaultOptions.map(String);
      setSelectedValues(new Set(stringValues));
      column?.setFilterValue(stringValues);
      defaultSetted.current = true;
    }
  }, [options, column]);

  useEffect(() => {
    setSelectedValues(getInitialSelectedValues());
  }, [column?.getFilterValue()]);

  const findDefaultOptions = (): (string | number)[] => {
    if (!options) return [];

    if (grouped) {
      return (options as FilterGroup[])
        .flatMap((group) => group.options)
        .filter((option) => option?.defaultOption)
        .map((option) => option.value);
    } else {
      return (options as FilterOption[])
        .filter((option) => option?.defaultOption)
        .map((option) => option.value);
    }
  };

  const columnName = column?.columnDef.meta?.name || title || "";
  const hasSelectedValues = selectedValues.size > 0;

  const handleSelectOption = (value: string) => {
    const stringValue = String(value);
    const newSelectedValues = new Set(selectedValues);

    if (newSelectedValues.has(stringValue)) {
      newSelectedValues.delete(stringValue);
    } else {
      newSelectedValues.add(stringValue);
    }

    setSelectedValues(newSelectedValues);
    const filterValues = Array.from(newSelectedValues);
    column?.setFilterValue(filterValues.length ? filterValues : undefined);
  };

  const handleSelectAll = () => {
    if (grouped) {
      const allValues = new Set(
        (options as FilterGroup[])?.flatMap((group) =>
          group.options?.map((option) => String(option.value))
        )
      );
      if (selectedValues.size === allValues.size) {
        setSelectedValues(new Set());
        column?.setFilterValue(undefined);
      } else {
        setSelectedValues(allValues);
        column?.setFilterValue(Array.from(allValues));
      }
    } else {
      const allValues = new Set(
        (options as FilterOption[])?.map((option) => String(option.value))
      );
      if (selectedValues.size === allValues.size) {
        setSelectedValues(new Set());
        column?.setFilterValue(undefined);
      } else {
        setSelectedValues(allValues);
        column?.setFilterValue(Array.from(allValues));
      }
    }
  };

  const handleClearFilters = () => {
    setSelectedValues(new Set());
    column?.setFilterValue(undefined);
  };

  const findOptionByValue = (value: string) => {
    const stringValue = String(value);
    if (grouped) {
      for (const group of options as FilterGroup[]) {
        const option = group.options?.find(
          (opt) => String(opt?.value) === stringValue
        );
        if (option) return option;
      }
    } else {
      return (options as FilterOption[])?.find(
        (opt) => String(opt?.value) === stringValue
      );
    }
    return undefined;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-dashed"
          aria-label={`Filtrar por ${columnName.toLowerCase()}`}
          loading={loading}
        >
          {!loading && <ListFilter />}
          <span className="capitalize">{columnName}</span>
          <ChevronsUpDown className="ml-auto opacity-50" />
          {hasSelectedValues && !loading && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4 my-auto" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selecionados
                  </Badge>
                ) : (
                  Array.from(selectedValues).map((value, index) => {
                    const option = findOptionByValue(value);

                    return (
                      <Badge
                        variant="secondary"
                        key={`selected-${index}`}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option?.label ?? value}
                      </Badge>
                    );
                  })
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start" sideOffset={8}>
        <Command>
          <CommandInput
            placeholder={`Buscar ${columnName.toLowerCase()}...`}
            className="placeholder:capitalize"
          />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            {options && !!options.length && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={handleSelectAll}
                    className="justify-between cursor-pointer"
                  >
                    <span>Selecionar todos</span>
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selectedValues.size ===
                          (grouped
                            ? (options as FilterGroup[]).flatMap(
                                (group) => group.options
                              ).length
                            : (options as FilterOption[]).length)
                          ? "bg-primary"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-3 w-3 p-0.5 text-primary-foreground" />
                    </div>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {grouped ? (
              (options as FilterGroup[])?.map((group, index) => (
                <CommandGroup
                  key={`${group.group}_${index}`}
                  heading={group.group}
                >
                  {group.options?.map((option) => {
                    const isSelected = selectedValues.has(String(option.value));
                    return (
                      <CommandItem
                        key={String(option.value)}
                        value={`${group.group} ${option.label} ${option.value}`}
                        onSelect={() =>
                          handleSelectOption(String(option.value))
                        }
                        className="justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {option.icon && (
                            <option.icon
                              className={cn(
                                "h-4 w-4 text-muted-foreground",
                                option.iconClassName
                              )}
                            />
                          )}
                          <span>{option.label}</span>
                        </div>
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="h-3 w-3 p-0.5 text-primary-foreground" />
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {(options as FilterOption[])?.map((option) => {
                  const isSelected = selectedValues.has(String(option.value));
                  return (
                    <CommandItem
                      key={String(option.value)}
                      value={`${option.label} ${option.value}`}
                      onSelect={() => handleSelectOption(String(option.value))}
                      className="justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {option.icon && (
                          <option.icon
                            className={cn(
                              "h-4 w-4 text-muted-foreground",
                              option.iconClassName
                            )}
                          />
                        )}
                        <span>{option.label}</span>
                      </div>
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className="h-3 w-3 p-0.5 text-primary-foreground" />
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
          {hasSelectedValues && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={handleClearFilters}
                  className="justify-center text-center text-sm cursor-pointer"
                >
                  <X className="size-4" />
                  Limpar filtros
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
