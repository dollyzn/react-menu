import type { RowData } from "@tanstack/react-table";
import { cloneElement, useCallback, useEffect, useState } from "react";
import { CalendarIcon, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Column } from "@/components/app/data-table/features";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { format, isEqual, isSameDay } from "date-fns";
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
} from "@/components/ui/drawer";
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
        const isSameRange = samePeriod(value, preset.from, preset.to);

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
      {/* vaul's DrawerTrigger doesn't take Base UI's `render` (it would drop
          the Button and its styles): on phones the same button opens the
          controlled drawer itself. */}
      {isMobile ? (
        cloneElement(
          trigger as React.ReactElement<{ onClick?: () => void; "aria-haspopup"?: string }>,
          { onClick: () => setOpen(true), "aria-haspopup": "dialog" },
          children
        )
      ) : (
        <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      )}
      <WrapperContent
        className={
          isMobile
            ? "flex flex-col p-0 gap-0 overflow-hidden max-h-screen"
            : "w-auto p-0"
        }
        // Placement is the popover's; the drawer would put them on a DOM node.
        {...(isMobile ? {} : { align: "start" as const, sideOffset: 8 })}
      >
        {isMobile ? (
          <>
            <DrawerHeader className="pb-2">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{description}</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-3 overflow-auto pb-2">
              <PresetChips
                onSelect={handleDateRangeChange}
                selected={dateRange}
                presets={presets}
                clearable={clearable}
              />
              <Calendar
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={handleCalendarSelect}
                numberOfMonths={1}
                locale={ptBR}
                disabled={disabled}
                // Bigger days to tap, the width of the phone.
                className="mx-auto bg-transparent [--cell-size:clamp(2.5rem,11.5vw,3rem)]"
              />
            </div>
            <footer className="flex items-center gap-2 border-t bg-muted/30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Período</span>
                <span className="block truncate text-sm font-semibold">
                  {rangeSummary(dateRange) ?? "Nenhum período"}
                </span>
              </span>
              {clearable && (
                <Button variant="ghost" disabled={!hasSelectedValues} onClick={() => onChange(undefined)}>
                  Limpar
                </Button>
              )}
              <Button onClick={() => setOpen(false)}>Aplicar</Button>
            </footer>
          </>
        ) : (
          <div className="overflow-auto">
            <div className="flex flex-row justify-between">
              <DatePresets onSelect={handleDateRangeChange} selected={dateRange} presets={presets} />
              <Separator orientation="vertical" className="h-auto!" />
              <Calendar
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={handleCalendarSelect}
                numberOfMonths={2}
                locale={ptBR}
                disabled={disabled}
                className="rounded-md"
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
        )}
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
      <div className="flex flex-col gap-1">
        {presets.map(({ label, shortcut, from, to }) => {
          const isActive = samePeriod(selected, from, to);
          return (
            <Button
              key={label}
              variant={isActive ? "default" : "ghost"}
              onClick={() => onSelect({ from, to })}
              size="sm"
              className="w-full gap-6 flex items-center justify-between"
            >
              <span>{label}</span>
              <Kbd>
                {shortcut}
              </Kbd>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A range is a preset when the days match: the one read back from the URL is
 * at midnight, the preset's ends at the end of the day.
 */
function samePeriod(range: DateRange | undefined, from: Date, to: Date) {
  return Boolean(range?.from && range.to && isSameDay(range.from, from) && isSameDay(range.to, to));
}

/** "8 – 14 de nov." / "8 de nov." / "A partir de 8 de nov.": the footer's summary. */
function rangeSummary(range: DateRange) {
  const day = (date: Date) => format(date, "d 'de' MMM", { locale: ptBR });
  if (range.from && range.to) {
    if (isEqual(range.from, range.to)) return day(range.from);
    return range.from.getMonth() === range.to.getMonth() && range.from.getFullYear() === range.to.getFullYear()
      ? `${format(range.from, "d")} – ${day(range.to)}`
      : `${day(range.from)} – ${day(range.to)}`;
  }
  if (range.from) return `A partir de ${day(range.from)}`;
  if (range.to) return `Até ${day(range.to)}`;
  return null;
}

/**
 * Phones: the quick periods as chips in a row that scrolls. (A Select opened
 * its list outside the drawer, where vaul swallows the taps.)
 */
function PresetChips({
  selected,
  onSelect,
  presets,
  clearable,
}: {
  selected: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
  presets: DatePreset[];
  clearable: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Períodos rápidos"
      className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] scroll-fade-x"
    >
      {presets.map(({ label, from, to }) => {
        const active = samePeriod(selected, from, to);
        return (
          <Button
            key={label}
            size="sm"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            className="h-9 shrink-0 rounded-full px-4"
            onClick={() => onSelect(active && clearable ? undefined : { from, to })}
          >
            {label}
          </Button>
        );
      })}
    </div>
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
    <div className="p-3 flex flex-col gap-3">
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
