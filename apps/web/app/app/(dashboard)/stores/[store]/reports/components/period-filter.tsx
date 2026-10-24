"use client";

import { CalendarIcon, ChevronsUpDown } from "lucide-react";
import { DateRangePicker } from "@/components/app/data-table/data-table-date-range-filter";
import { Button } from "@/components/ui/button";
import {
  formatPeriod,
  fromLocalDate,
  reportPresets,
  toLocalDate,
  type ReportPeriod,
} from "@/lib/report-period";

/** The data tables' date picker (quick periods, calendar, custom range), always holding a period. */
export function PeriodFilter({
  period,
  today,
  onChange,
}: {
  period: ReportPeriod;
  today: string;
  onChange: (period: ReportPeriod) => void;
}) {
  const presets = reportPresets(today);
  const from = toLocalDate(period.from);
  const to = toLocalDate(period.to);
  const preset = presets.find((option) => option.from.getTime() === from.getTime() && option.to.getTime() === to.getTime());

  return (
    <DateRangePicker
      title="Período do relatório"
      value={{ from, to }}
      onChange={(range) => {
        if (!range?.from) return;
        onChange({ from: fromLocalDate(range.from), to: fromLocalDate(range.to ?? range.from) });
      }}
      presets={presets}
      disabled={{ after: toLocalDate(today) }}
      clearable={false}
      trigger={<Button variant="outline" size="lg" aria-label={`Período: ${preset?.label ?? formatPeriod(period)}`} />}
    >
      <CalendarIcon className="text-primary" />
      <span className="font-medium">{preset?.label ?? "Personalizado"}</span>
      <span className="hidden text-muted-foreground sm:inline">· {formatPeriod(period)}</span>
      <ChevronsUpDown className="opacity-50" />
    </DateRangePicker>
  );
}
