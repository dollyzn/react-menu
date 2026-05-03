import type { Column } from "@tanstack/react-table";
import { useState, useEffect } from "react";
import { Check, ChevronDown, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import type { FilterGroup, FilterOption } from ".";

interface DataTableSelectFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  options?: FilterOption[] | FilterGroup[];
  title?: string;
  loading?: boolean;
  grouped?: boolean;
}

export function DataTableSelectFilter<TData, TValue>({
  column,
  options,
  title,
  loading,
  grouped,
}: DataTableSelectFilterProps<TData, TValue>) {
  const [selectedValue, setSelectedValue] = useState<string | undefined>(
    column?.getFilterValue() ? String(column.getFilterValue()) : undefined
  );
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (grouped) {
      const defaultOption = (options as FilterGroup[])
        ?.flatMap((group) => group.options)
        ?.find((option) => option?.defaultOption);
      if (defaultOption && !selectedValue) {
        const stringValue = String(defaultOption.value);
        setSelectedValue(stringValue);
        column?.setFilterValue(stringValue);
      }
    } else {
      const defaultOption = (options as FilterOption[])?.find(
        (option) => option?.defaultOption
      );
      if (defaultOption && !selectedValue) {
        const stringValue = String(defaultOption.value);
        setSelectedValue(stringValue);
        column?.setFilterValue(stringValue);
      }
    }
  }, [options, column]);

  useEffect(() => {
    const filterValue = column?.getFilterValue();
    setSelectedValue(filterValue ? String(filterValue) : undefined);
  }, [column?.getFilterValue()]);

  const columnName = title || column?.columnDef.meta?.name || "";
  const hasFilter = !!selectedValue;

  const findSelectedOption = () => {
    if (!selectedValue) return undefined;
    const stringValue = String(selectedValue);

    if (grouped) {
      return (options as FilterGroup[])
        ?.flatMap((group) => group.options)
        ?.find((option) => option && String(option.value) === stringValue);
    }
    return (options as FilterOption[])?.find(
      (option) => option && String(option.value) === stringValue
    );
  };

  const selectedOption = findSelectedOption();

  const handleSelect = (value: string) => {
    if (value === "clear") {
      setSelectedValue(undefined);
      column?.setFilterValue(undefined);
    } else {
      const stringValue = String(value);
      setSelectedValue(stringValue);
      column?.setFilterValue(stringValue);
    }
    setOpen(false);
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
          <div className="flex items-center gap-1 truncate">
            {!hasFilter && <span className="capitalize">{columnName}</span>}
            {hasFilter && (
              <>
                <span className="text-sm font-medium mr-1 capitalize">
                  {columnName}:
                </span>
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal flex items-center gap-1"
                >
                  <span className="truncate max-w-[100px]">
                    {selectedOption?.label}
                  </span>
                </Badge>
              </>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[220px]" align="start" sideOffset={8}>
        <Command>
          <CommandInput
            placeholder={`Buscar ${columnName.toLowerCase()}...`}
            className="h-9 flex-1 border-0 outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

            {grouped ? (
              (options as FilterGroup[])?.map((group, index) => (
                <CommandGroup
                  key={`${group.group}_${index}`}
                  heading={group.group}
                >
                  {group.options
                    ?.filter((option) =>
                      option?.label
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                    )
                    .map((option) => {
                      const optionStringValue = String(option.value);
                      const isSelected = selectedValue === optionStringValue;
                      return (
                        <CommandItem
                          key={optionStringValue}
                          value={optionStringValue}
                          onSelect={() => handleSelect(optionStringValue)}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {option.icon && (
                              <option.icon
                                className={cn(
                                  "h-4 w-4 text-muted-foreground",
                                  isSelected && "text-primary",
                                  option.iconClassName
                                )}
                              />
                            )}
                            <span>{option.label}</span>
                          </div>
                          {isSelected ? (
                            <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary">
                              <Check className="h-3 w-3 p-0.5 text-primary-foreground" />
                            </div>
                          ) : (
                            option.quantity !== undefined && (
                              <div className="text-xs me-1">
                                {option.quantity}
                              </div>
                            )
                          )}
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {(options as FilterOption[])
                  ?.filter((option) =>
                    option.label
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  )
                  .map((option) => {
                    const optionStringValue = String(option.value);
                    const isSelected = selectedValue === optionStringValue;
                    return (
                      <CommandItem
                        key={optionStringValue}
                        value={optionStringValue}
                        onSelect={() => handleSelect(optionStringValue)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {option.icon && (
                            <option.icon
                              className={cn(
                                "h-4 w-4 text-muted-foreground",
                                isSelected && "text-primary",
                                option.iconClassName
                              )}
                            />
                          )}
                          <span>{option.label}</span>
                        </div>
                        {isSelected ? (
                          <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary">
                            <Check className="h-3 w-3 p-0.5 text-primary-foreground" />
                          </div>
                        ) : (
                          option.quantity !== undefined && (
                            <div className="text-xs me-1">
                              {option.quantity}
                            </div>
                          )
                        )}
                      </CommandItem>
                    );
                  })}
              </CommandGroup>
            )}
            {hasFilter && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => handleSelect("clear")}
                    className="justify-center text-center text-sm text-muted-foreground"
                  >
                    Limpar filtro
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
