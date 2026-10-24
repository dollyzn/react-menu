import type { RowData } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarIcon, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Column } from "@/components/app/data-table/features";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { format, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange, Matcher } from "react-day-picker";
import {
  presets as defaultPresets,
  type DatePreset,
} from "./constants/date-preset";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";
import { FilterSummary, filterTriggerClassName } from "./data-table-filter-parts";

interface DataTableDateRangeFilterProps<TData extends RowData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  presets?: DatePreset[];
}

export function DataTableDateRangeFilter<TData extends RowData, TValue>({
  column,
  title,
  presets = defaultPresets,
}: DataTableDateRangeFilterProps<TData, TValue>) {
  // The column filter (from the URL) is the source of truth: no local copy
  // that "Limpar" or a reload could leave stale.
  const dateRange: DateRange = (column?.getFilterValue() as DateRange | undefined) ?? {
    from: undefined,
    to: undefined,
  };
  const columnName = title || column?.columnDef.meta?.name || "Data";
  const hasSelectedValues = Boolean(dateRange.from || dateRange.to);

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return isEqual(dateRange.from, dateRange.to)
        ? format(dateRange.from, "dd/MM/yyyy")
        : `${format(dateRange.from, "dd/MM/yyyy")} - ${format(
            dateRange.to,
            "dd/MM/yyyy"
          )}`;
    } else if (dateRange.from) {
      return `A partir de ${format(dateRange.from, "dd/MM/yyyy")}`;
    } else if (dateRange.to) {
      return `Até ${format(dateRange.to, "dd/MM/yyyy")}`;
    }
    return "";
  };

  return (
    <DateRangePicker
      title={`Filtrar por ${columnName}`}
      value={dateRange}
      onChange={(range) => column?.setFilterValue(range?.from || range?.to ? range : undefined)}
      presets={presets}
      trigger={
        <Button
          variant="outline"
          size="sm"
          className={filterTriggerClassName(hasSelectedValues)}
          aria-label={`Filtrar por ${columnName.toLowerCase()}`}
        />
      }
    >
      <CalendarIcon className={cn(hasSelectedValues && "text-primary")} />
      <span className="first-letter:uppercase">{columnName}</span>
      {hasSelectedValues && <FilterSummary>{formatDateRange()}</FilterSummary>}
      <ChevronsUpDown className="opacity-50" />
    </DateRangePicker>
  );
}

/**
 * Quick periods (with keyboard shortcuts), a calendar and a custom range, in
 * a popover (a drawer on phones). Controlled: `onChange` gets every change,
 * `undefined` when cleared.
 */
export function DateRangePicker({
  value,
  onChange,
  presets = defaultPresets,
  title,
  description = "Selecione um período de data",
  trigger,
  children,
  disabled,
  clearable = true,
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  presets?: DatePreset[];
  /** Drawer title on phones. */
  title: string;
  description?: string;
  /** The trigger element (a Button); `children` go inside it. */
  trigger: React.ReactElement;
  children: React.ReactNode;
  /** Days that can't be picked (e.g. the future). */
  disabled?: Matcher | Matcher[];
  clearable?: boolean;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const dateRange: DateRange = value ?? { from: undefined, to: undefined };

  const Wrapper = isMobile ? Drawer : Popover;
  const WrapperTrigger = isMobile ? DrawerTrigger : PopoverTrigger;
  const WrapperContent = isMobile ? DrawerContent : PopoverContent;

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => onChange(range?.from || range?.to ? range : undefined),
    [onChange]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      const preset = presets.find((preset) => preset.shortcut === e.key);
      if (preset) {
        const isSameRange =
          value?.from?.getTime() === preset.from.getTime() &&
          value?.to?.getTime() === preset.to.getTime();

        if (isSameRange && clearable) {
          handleDateRangeChange({ from: undefined, to: undefined });
        } else {
          handleDateRangeChange({ from: preset.from, to: preset.to });
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, presets, value, clearable, handleDateRangeChange]);

  const hasSelectedValues = Boolean(dateRange.from || dateRange.to);

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (range && range.from && !range.to) {
      handleDateRangeChange({ from: range.from, to: range.from });
    } else if (range || clearable) {
      handleDateRangeChange(range);
    }
  };

  return (
    <Wrapper open={open} onOpenChange={setOpen}>
      <WrapperTrigger render={trigger}>{children}</WrapperTrigger>
      <WrapperContent
        className={
          isMobile
            ? "flex flex-col p-0 gap-0 overflow-hidden max-h-screen"
            : "w-auto p-0"
        }
        align="start"
        sideOffset={8}
      >
        {isMobile && (
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
        )}
        <div className="overflow-auto">
          <div className="flex flex-col justify-between sm:flex-row">
            <div className="hidden md:block">
              <DatePresets
                onSelect={handleDateRangeChange}
                selected={dateRange}
                presets={presets}
              />
            </div>
            <div className="block md:hidden px-3">
              <DatePresetsSelect
                onSelect={handleDateRangeChange}
                selected={dateRange}
                presets={presets}
              />
            </div>

            <Separator orientation="vertical" className="h-auto!" />

            {/* Calendar */}
            <Calendar
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={isMobile ? 1 : 2}
              locale={ptBR}
              disabled={disabled}
              className="rounded-md mx-auto md:mx-0"
              autoFocus
            />
          </div>
          <Separator />
          <CustomDateRange
            onSelect={handleDateRangeChange}
            selected={dateRange}
            hasSelectedValues={hasSelectedValues}
            clearable={clearable}
            disabled={disabled}
            onClear={() => onChange(undefined)}
            onApply={() => setOpen(false)}
          />
        </div>
      </WrapperContent>
    </Wrapper>
  );
}

function DatePresets({
  selected,
  onSelect,
  presets,
}: {
  selected: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
  presets: DatePreset[];
}) {
  return (
    <div className="p-3 flex flex-col gap-3">
      <h3 className="text-xs mx-3 text-muted-foreground uppercase">
        Períodos rápidos
      </h3>
      <div className="space-y-1">
        {presets.map(({ label, shortcut, from, to }) => {
          const isActive =
            selected?.from?.getTime() === from.getTime() &&
            selected?.to?.getTime() === to.getTime();
          return (
            <Button
              key={label}
              variant={isActive ? "default" : "ghost"}
              onClick={() => onSelect({ from, to })}
              size="sm"
              className="w-full gap-6 flex items-center justify-between"
            >
              <span>{label}</span>
              <kbd className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs font-mono">
                {shortcut}
              </kbd>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePresetsSelect({
  selected,
  onSelect,
  presets,
}: {
  selected: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
  presets: DatePreset[];
}) {
  const value = useMemo(() => {
    const from = selected?.from;
    const to = selected?.to;
    if (!from || !to) return undefined;
    return presets.find(
      (p) =>
        p.from.getTime() === from.getTime() && p.to.getTime() === to.getTime()
    )?.shortcut;
  }, [selected, presets]);

  return (
    <Select
      value={value}
      items={presets.map(({ label, shortcut }) => ({ value: shortcut, label }))}
      onValueChange={(v) => {
        const preset = presets.find((p) => p.shortcut === v);
        if (preset) {
          onSelect({ from: preset.from, to: preset.to });
        } else {
          onSelect(undefined);
        }
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Períodos rápidos" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Períodos rápidos</SelectLabel>
          {presets.map(({ label, shortcut }) => (
            <SelectItem
              key={shortcut}
              value={shortcut}
              className="flex items-center justify-between [&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:justify-between"
            >
              <span>{label}</span>
              <kbd className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-xs font-mono">
                {shortcut}
              </kbd>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CustomDateRange({
  selected,
  onSelect,
  hasSelectedValues,
  clearable,
  disabled,
  onClear,
  onApply,
}: {
  selected: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
  hasSelectedValues: boolean;
  clearable: boolean;
  disabled?: Matcher | Matcher[];
  onClear: () => void;
  onApply: () => void;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  function formatDatePt(date: Date | undefined): string {
    if (!date) {
      return "";
    }
    return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  const disabledStartDate = [...[disabled ?? []].flat(), ...(selected?.to ? [{ after: selected.to }] : [])];
  const disabledEndDate = [...[disabled ?? []].flat(), ...(selected?.from ? [{ before: selected.from }] : [])];

  return (
    <div className="p-3 space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Período personalizado
      </h4>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="start-date"
            className="text-xs text-muted-foreground px-1"
          >
            Data inicial
          </Label>

          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  id="date-picker"
                  className="w-full justify-between font-normal"
                />
              }
            >
              {selected?.from ? formatDatePt(selected.from) : "Selecionar data"}
              <CalendarIcon className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                selected={selected?.from}
                defaultMonth={selected?.from || selected?.to || undefined}
                captionLayout="dropdown"
                onSelect={(date) => {
                  onSelect({
                    from: date,
                    to: selected?.to,
                  });
                }}
                locale={ptBR}
                disabled={disabledStartDate}
              />
            </PopoverContent>
          </Popover>

          {selected?.from && (
            <div className="text-muted-foreground px-1 text-xs">
              Início em{" "}
              <span className="font-medium">{formatDatePt(selected.from)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="end-date"
            className="text-xs text-muted-foreground px-1"
          >
            Data final
          </Label>

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  id="date-picker"
                  className="w-full justify-between font-normal"
                />
              }
            >
              {selected?.to ? formatDatePt(selected.to) : "Selecionar data"}
              <CalendarIcon className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                selected={selected?.to}
                defaultMonth={selected?.to || selected?.from || undefined}
                captionLayout="dropdown"
                onSelect={(date) => {
                  onSelect({
                    from: selected?.from,
                    to: date,
                  });
                }}
                locale={ptBR}
                disabled={disabledEndDate}
              />
            </PopoverContent>
          </Popover>

          {selected?.to && (
            <div className="text-muted-foreground px-1 text-xs">
              Fim em{" "}
              <span className="font-medium">{formatDatePt(selected.to)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="default"
          size="sm"
          className="text-xs"
          onClick={onApply}
        >
          Aplicar
        </Button>

        {clearable && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onClear}
            disabled={!hasSelectedValues}
          >
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
