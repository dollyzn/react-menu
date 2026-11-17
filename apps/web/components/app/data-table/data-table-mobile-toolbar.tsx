"use client";

import type { RowData } from "@tanstack/react-table";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, LayoutGrid, ListFilter, Table2, X } from "lucide-react";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SearchInput } from "@/components/app/search-input";
import { useLastValue } from "@/hooks/use-last-value";
import { cn } from "@/lib/utils";
import type { ColumnsConfig, DataTableInstance, FilterGroup, FilterOption, ViewMode } from ".";
import { presets } from "./constants/date-preset";
import { rangeSummary, samePeriod } from "./data-table-date-range-filter";
import { SEARCH_THRESHOLD, flattenOptions } from "./data-table-filter-parts";

type Panel = "filters" | "sort";

interface DataTableMobileToolbarProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  columnsConfig?: ColumnsConfig[];
  hasCardView: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** Rows still on their way (the count may be about to change). */
  loading?: boolean;
}

const plural = (count: number) => (count === 1 ? "1 resultado" : `${count} resultados`);

/**
 * Phones: one quiet row that stays under the header while the list scrolls
 * (the search, then "Filtros" and "Ordenar", which open a drawer), and under
 * it the filters in use (✕ takes one off) and how many results there are.
 * The drawer is built from the same `columnsConfig` the desktop toolbar
 * uses; filters apply as they are picked, as on the desktop.
 */
export function DataTableMobileToolbar<TData extends RowData>({
  table,
  columnsConfig = [],
  hasCardView,
  viewMode,
  setViewMode,
  loading,
}: DataTableMobileToolbarProps<TData>) {
  const [panel, setPanel] = useState<Panel | null>(null);
  // The drawer keeps its content while it slides away.
  const shown = useLastValue(panel);
  const [sentinel, stuck] = useStuck();

  const searchConfig = columnsConfig.find((config) => config.searchable && table.getColumn(config.key));
  const filterConfigs = columnsConfig.filter((config) => !config.searchable && table.getColumn(config.key));
  const sortable = sortableColumns(table);
  const sorted = sortable.find((column) => column.getIsSorted());
  const direction = sorted?.getIsSorted();
  const activeCount = table.state.columnFilters.filter(
    (filter) => filter.id !== searchConfig?.key && hasValue(filter.value)
  ).length;
  const clearFilters = () =>
    table.setColumnFilters((filters) => filters.filter((filter) => filter.id === searchConfig?.key));
  const count = loading && table.getRowCount() === 0 ? "Carregando…" : plural(table.getRowCount());

  useFilterDefaults(table, filterConfigs);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px" />
      {/* Below the panel's header (h-12), which stays on screen too. */}
      <div
        className={cn(
          "sticky top-12 z-6 -mt-px flex items-center gap-2 bg-background/90 py-2 backdrop-blur-md transition-shadow duration-200",
          stuck && "shadow-[0_1px_0_var(--border)]"
        )}
      >
        {searchConfig && <MobileSearch table={table} columnId={searchConfig.key} />}

        {(filterConfigs.length > 0 || hasCardView) && (
          <Button
            variant="outline"
            size="icon-lg"
            className={cn("relative shrink-0", activeCount > 0 && "border-primary/40 bg-primary/5")}
            aria-haspopup="dialog"
            aria-label={activeCount > 0 ? `Filtros (${activeCount} em uso)` : "Filtros"}
            onClick={() => setPanel("filters")}
          >
            <ListFilter className={cn(activeCount > 0 && "text-primary")} />
            {activeCount > 0 && (
              <span
                aria-hidden
                className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums ring-2 ring-background"
              >
                {activeCount}
              </span>
            )}
          </Button>
        )}

        {sortable.length > 0 && (
          <Button
            variant="outline"
            size="lg"
            className="max-w-32 min-w-0 shrink-0"
            aria-haspopup="dialog"
            aria-label={
              sorted && direction
                ? `Ordenar: ${nameOf(sorted)}, ${DIRECTIONS[sortKind(table, sorted.id)][direction].toLowerCase()}`
                : "Ordenar"
            }
            onClick={() => setPanel("sort")}
          >
            {direction === "asc" ? <ArrowUp /> : <ArrowDown />}
            <span className="truncate">{sorted ? nameOf(sorted) : "Ordenar"}</span>
          </Button>
        )}
      </div>

      <div className="flex min-h-7 items-start gap-2 pb-3">
        <ActiveFilterChips table={table} configs={filterConfigs} />
        <p
          className="ml-auto flex h-6 shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {loading && <Spinner className="size-3" aria-hidden />}
          {count}
        </p>
      </div>

      <Drawer open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="flex-row items-center justify-between gap-2 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <div className="flex flex-col gap-0.5">
              <DrawerTitle>{shown === "sort" ? "Ordenar" : "Filtros"}</DrawerTitle>
              <DrawerDescription>
                {shown === "sort" ? "A ordem da lista." : "Valem assim que você escolhe."}
              </DrawerDescription>
            </div>
            {shown === "filters" && activeCount > 0 && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </DrawerHeader>

          <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-2">
            {shown === "filters" &&
              filterConfigs.map((config) => <FilterSection key={config.key} table={table} config={config} />)}
            {shown === "sort" && <SortSection table={table} />}
            {shown === "filters" && hasCardView && (
              <Section title="Exibir como">
                <ToggleGroup
                  aria-label="Exibir como"
                  variant="outline"
                  size="lg"
                  spacing={0}
                  className="w-full"
                  value={[viewMode]}
                  onValueChange={(value) => value[0] && setViewMode(value[0] as ViewMode)}
                >
                  <ToggleGroupItem value="cards" className="flex-1">
                    <LayoutGrid /> Cartões
                  </ToggleGroupItem>
                  <ToggleGroupItem value="table" className="flex-1">
                    <Table2 /> Tabela
                  </ToggleGroupItem>
                </ToggleGroup>
              </Section>
            )}
          </div>

          <DrawerFooter className="border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button size="lg" onClick={() => setPanel(null)}>
              {loading && <Spinner aria-hidden />}
              Ver {plural(table.getRowCount())}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/* ---------- Sticky row ---------- */

/** Whether the row has reached the header: a line under it shows then. */
function useStuck() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(false);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    // The header is 48px tall: past it, the row is stuck.
    const observer = new IntersectionObserver(([entry]) => setValue(!entry.isIntersecting), {
      rootMargin: "-49px 0px 0px 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [sentinel, value] as const;
}

/* ---------- Search ---------- */

/** The searchable column as a field: applies after a pause or on Enter. */
function MobileSearch<TData extends RowData>({ table, columnId }: { table: DataTableInstance<TData>; columnId: string }) {
  const column = table.getColumn(columnId);
  const applied = (column?.getFilterValue() as string | undefined) ?? "";
  const [text, setText] = useState(applied);
  const [seen, setSeen] = useState(applied);
  // Cleared or changed elsewhere ("Limpar filtros"): show it.
  if (applied !== seen) {
    setSeen(applied);
    setText(applied);
  }

  const apply = (value: string) => table.getColumn(columnId)?.setFilterValue(value.trim() || undefined);

  useEffect(() => {
    if (text.trim() === applied) return;
    const timer = setTimeout(() => apply(text), 400);
    return () => clearTimeout(timer);
    // `apply` reads the table, whose reference never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, applied]);

  const label = column?.columnDef.meta?.name ?? "Buscar";
  return (
    <SearchInput
      value={text}
      onValueChange={setText}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
          apply(text);
        }
      }}
      placeholder={label}
      aria-label={`Buscar por ${label.toLowerCase()}`}
      enterKeyHint="search"
      wrapperClassName="min-w-0 flex-1"
      className="h-9 text-ellipsis"
    />
  );
}

/* ---------- Chips ---------- */

/** One chip per value in use (a date range is one); ✕ takes it off. */
function ActiveFilterChips<TData extends RowData>({
  table,
  configs,
}: {
  table: DataTableInstance<TData>;
  configs: ColumnsConfig[];
}) {
  const chips = table.state.columnFilters.flatMap((filter) => {
    const config = configs.find((c) => c.key === filter.id);
    const column = table.getColumn(filter.id);
    if (!config || !column || !hasValue(filter.value)) return [];
    // As the desktop button names it: the config's title first.
    const name = config.title ?? column.columnDef.meta?.name ?? filter.id;
    const options = flattenOptions(config.filterOptions, config.grouped);
    const labelOf = (value: unknown) => options.find((o) => String(o.value) === String(value))?.label ?? String(value);

    if (Array.isArray(filter.value)) {
      const values = filter.value as unknown[];
      return values.map((value) => ({
        key: `${filter.id}:${String(value)}`,
        name,
        label: labelOf(value),
        remove: () => {
          const rest = values.filter((v) => v !== value);
          column.setFilterValue(rest.length ? rest : undefined);
        },
      }));
    }
    const label =
      config.type === "date-range" ? (rangeSummary(filter.value as DateRange) ?? name) : labelOf(filter.value);
    return [{ key: filter.id, name, label, remove: () => column.setFilterValue(undefined) }];
  });

  if (chips.length === 0) return null;
  return (
    <ul aria-label="Filtros em uso" className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <li key={chip.key} className="min-w-0">
          <Button
            variant="outline"
            size="xs"
            className="max-w-full rounded-full pr-1.5 font-normal"
            aria-label={`Tirar o filtro ${chip.name}: ${chip.label}`}
            onClick={chip.remove}
          >
            <span className="truncate">{chip.label}</span>
            <X className="text-muted-foreground" />
          </Button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => table.setColumnFilters((filters) => filters.filter((f) => !configs.some((c) => c.key === f.id)))}
          >
            Limpar tudo
          </Button>
        </li>
      )}
    </ul>
  );
}

/* ---------- Drawer sections ---------- */

function Section({ title, children }: { title: string | null; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className="flex flex-col gap-2.5">
      {title && (
        <h3 id={id} className="text-sm font-medium">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function Options({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {children}
    </div>
  );
}

/** A choice: outlined, with a check and the tinted look of the desktop filters when on. */
function Option({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <Toggle
      variant="outline"
      size="lg"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="max-w-full rounded-full px-3 font-normal aria-pressed:border-primary/40 aria-pressed:bg-primary/5"
    >
      {pressed && <Check className="text-primary" />}
      <span className="truncate">{children}</span>
    </Toggle>
  );
}

/** A filter of the table as a section: its options, or the period. */
function FilterSection<TData extends RowData>({
  table,
  config,
}: {
  table: DataTableInstance<TData>;
  config: ColumnsConfig;
}) {
  const column = table.getColumn(config.key)!;
  const name = column.columnDef.meta?.name ?? config.title ?? config.key;
  const value = column.getFilterValue();

  if (config.type === "date-range") return <PeriodSection name={config.title ?? name} column={column} />;

  const multiple = config.type !== "select";
  const selected = new Set(
    value === undefined || value === null || value === ""
      ? []
      : (Array.isArray(value) ? value : [value]).map(String)
  );
  const toggle = (option: string) => {
    if (!multiple) {
      column.setFilterValue(selected.has(option) ? undefined : option);
      return;
    }
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    column.setFilterValue(next.size ? [...next] : undefined);
  };

  return (
    <Section title={name}>
      {config.loading ? (
        <Spinner className="size-4 text-muted-foreground" aria-label={`Carregando ${name.toLowerCase()}`} />
      ) : (
        <OptionList
          name={name}
          options={config.filterOptions}
          grouped={config.grouped}
          selected={selected}
          onToggle={toggle}
        />
      )}
    </Section>
  );
}

/** The options; a search over them when there are many. */
function OptionList({
  name,
  options,
  grouped,
  selected,
  onToggle,
}: {
  name: string;
  options?: FilterOption[] | FilterGroup[];
  grouped?: boolean;
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const all = flattenOptions(options, grouped);
  const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const matches = (option: FilterOption) => !query || normalize(option.label).includes(normalize(query));
  const groups: { group?: string; options: FilterOption[] }[] = grouped
    ? ((options as FilterGroup[] | undefined) ?? []).map((g) => ({ group: g.group, options: g.options ?? [] }))
    : [{ options: all }];
  const visible = groups
    .map((g) => ({ ...g, options: g.options.filter(matches) }))
    .filter((g) => g.options.length > 0);

  return (
    <div className="flex flex-col gap-2.5">
      {all.length >= SEARCH_THRESHOLD && (
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder={`Buscar ${name.toLowerCase()}…`}
          aria-label={`Buscar ${name.toLowerCase()}`}
          className="h-9"
        />
      )}
      {visible.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma opção encontrada.</p>}
      {visible.map((g, index) => (
        <div key={g.group ?? index} className="flex flex-col gap-1.5">
          {g.group && <p className="text-xs text-muted-foreground">{g.group}</p>}
          <Options label={g.group ?? name}>
            {g.options.map((option) => (
              <Option
                key={String(option.value)}
                pressed={selected.has(String(option.value))}
                onPressedChange={() => onToggle(String(option.value))}
              >
                {option.label}
                {option.quantity !== undefined && (
                  <span className="ml-1 text-xs text-muted-foreground tabular-nums">{option.quantity}</span>
                )}
              </Option>
            ))}
          </Options>
        </div>
      ))}
    </div>
  );
}

/** The period: the desktop's quick periods, and a calendar on demand. */
function PeriodSection<TData extends RowData>({
  name,
  column,
}: {
  name: string;
  column: NonNullable<ReturnType<DataTableInstance<TData>["getColumn"]>>;
}) {
  const range = column.getFilterValue() as DateRange | undefined;
  const preset = presets.find((p) => samePeriod(range, p.from, p.to));
  const custom = range && !preset ? rangeSummary(range) : null;
  const [calendar, setCalendar] = useState(false);
  const set = (next: DateRange | undefined) => column.setFilterValue(next?.from || next?.to ? next : undefined);

  return (
    <Section title={name}>
      <Options label="Períodos rápidos">
        {presets.map((p) => (
          <Option
            key={p.label}
            pressed={p === preset}
            onPressedChange={() => set(p === preset ? undefined : { from: p.from, to: p.to })}
          >
            {p.label}
          </Option>
        ))}
      </Options>
      <Button
        variant="outline"
        size="lg"
        className="justify-between font-normal"
        aria-expanded={calendar}
        onClick={() => setCalendar((open) => !open)}
      >
        <span className={cn(!custom && "text-muted-foreground")}>{custom ?? "Escolher datas"}</span>
        <ChevronDown className={cn("text-muted-foreground transition-transform", calendar && "rotate-180")} />
      </Button>
      {calendar && (
        <Calendar
          mode="range"
          defaultMonth={range?.from}
          selected={range}
          onSelect={(next) => set(next?.from && !next.to ? { from: next.from, to: next.from } : next)}
          numberOfMonths={1}
          locale={ptBR}
          // The drawer's own background, and days as wide as the phone allows.
          className="mx-auto bg-transparent p-0 [--cell-size:clamp(2.25rem,11vw,2.75rem)]"
        />
      )}
    </Section>
  );
}

/**
 * Ordering as a list of columns; the chosen one holds its direction, named
 * by what the column holds ("Mais recentes", "Maior", "A–Z").
 */
function SortSection<TData extends RowData>({ table }: { table: DataTableInstance<TData> }) {
  const columns = sortableColumns(table);
  const sorted = columns.find((column) => column.getIsSorted());
  const direction = sorted?.getIsSorted() || undefined;
  return (
    <div role="radiogroup" aria-label="Ordenar por" className="flex flex-col divide-y overflow-hidden rounded-lg border">
      {columns.map((column) => {
        const on = column === sorted;
        const kind = sortKind(table, column.id);
        const labels = DIRECTIONS[kind];
        return (
          <div key={column.id} className={cn("flex min-h-11 items-center gap-2 pr-1.5", on && "bg-muted/50")}>
            <button
              type="button"
              role="radio"
              aria-checked={on}
              className="flex h-11 min-w-0 flex-1 items-center gap-3 px-3 text-left text-sm outline-none focus-visible:bg-muted"
              onClick={() => !on && column.toggleSorting(FIRST_DESC[kind])}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                  on ? "border-primary" : "border-muted-foreground/40"
                )}
              >
                {on && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className={cn("truncate", on && "font-medium")}>{nameOf(column)}</span>
            </button>
            {on && direction && (
              <ToggleGroup
                aria-label={`Direção de ${nameOf(column).toLowerCase()}`}
                variant="outline"
                size="sm"
                spacing={0}
                className="shrink-0 bg-background"
                value={[direction]}
                onValueChange={(value) => value[0] && column.toggleSorting(value[0] === "desc")}
              >
                {(FIRST_DESC[kind] ? (["desc", "asc"] as const) : (["asc", "desc"] as const)).map((dir) => (
                  <ToggleGroupItem key={dir} value={dir} className="px-2">
                    {labels[dir]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </div>
        );
      })}
    </div>
  );
}

type SortKind = "date" | "number" | "text";

/** The direction in the column's own words. */
const DIRECTIONS: Record<SortKind, Record<"asc" | "desc", string>> = {
  date: { desc: "Mais recentes", asc: "Mais antigos" },
  number: { desc: "Maior", asc: "Menor" },
  text: { asc: "A–Z", desc: "Z–A" },
};
/** Where a column starts when picked: newest and biggest first, text from A. */
const FIRST_DESC: Record<SortKind, boolean> = { date: true, number: true, text: false };

/** What a column holds, read from the first row (dates come as ISO strings), or from its id. */
function sortKind<TData extends RowData>(table: DataTableInstance<TData>, columnId: string): SortKind {
  const value = table.getCoreRowModel().rows[0]?.getValue(columnId);
  if (typeof value === "number") return "number";
  if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))) return "date";
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return "number";
  if (value !== undefined && value !== null) return "text";
  // No rows to look at: the column's name tells.
  if (/(At|date|Date)$/.test(columnId)) return "date";
  if (/(price|total|amount|due|paid|count|quantity|stock)/i.test(columnId)) return "number";
  return "text";
}

/* ---------- Helpers ---------- */

function sortableColumns<TData extends RowData>(table: DataTableInstance<TData>) {
  return table.getAllColumns().filter((column) => typeof column.accessorFn !== "undefined" && column.getCanSort());
}

function nameOf(column: { id: string; columnDef: { meta?: { name?: string } } }) {
  return column.columnDef.meta?.name ?? column.id;
}

function hasValue(value: unknown) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object" && ("from" in value || "to" in value)) {
    const range = value as DateRange;
    return Boolean(range.from || range.to);
  }
  return true;
}

/**
 * The options' defaults (`defaultOption`), as the desktop filters apply them
 * when they show up: here the filters live in the drawer, so the toolbar
 * applies them once.
 */
function useFilterDefaults<TData extends RowData>(table: DataTableInstance<TData>, configs: ColumnsConfig[]) {
  const applied = useRef(new Set<string>());
  useEffect(() => {
    for (const config of configs) {
      if (applied.current.has(config.key) || config.type === "date-range") continue;
      const defaults = flattenOptions(config.filterOptions, config.grouped).filter((o) => o?.defaultOption);
      if (defaults.length === 0) continue;
      applied.current.add(config.key);
      const column = table.getColumn(config.key);
      if (!column || column.getFilterValue()) continue;
      column.setFilterValue(
        config.type === "select" ? String(defaults[0].value) : defaults.map((o) => String(o.value))
      );
    }
  }, [configs, table]);
}
