import type { DatePreset } from "@/components/app/data-table/constants/date-preset";
import { BUSINESS_TIMEZONE } from "@/lib/opening-hours";

/** A report period: business days "YYYY-MM-DD", inclusive (the API's shape). */
export type ReportPeriod = { from: string; to: string };

/** The API refuses longer periods. */
export const MAX_REPORT_DAYS = 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today in the stores' timezone, "YYYY-MM-DD". */
export function businessToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Calendar math on "YYYY-MM-DD" (UTC noon, so no timezone or DST shifts). */
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/** The last `days` days up to today. */
export const lastDays = (days: number, today = businessToday()): ReportPeriod => ({
  from: addDays(today, 1 - days),
  to: today,
});

/** A valid custom period from the URL (`de`, `ate`), or null. */
export function customPeriod(from: string | null, to: string | null): ReportPeriod | null {
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) return null;
  return daysBetween(from, to) <= MAX_REPORT_DAYS ? { from, to } : null;
}

/** "YYYY-MM-DD" as a local Date (for the calendar) and back. */
export const toLocalDate = (date: string) => new Date(`${date}T00:00:00`);
export const fromLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const full = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const utc = (date: string) => new Date(`${date}T12:00:00Z`);

/** "24 de out." */
export const formatDay = (date: string) => dayMonth.format(utc(date));
/** "sex., 24 de out." */
export const formatWeekday = (date: string) => weekday.format(utc(date));

/** "24 de out. de 2026" or "1 – 24 de out. de 2026". */
export function formatPeriod({ from, to }: ReportPeriod) {
  if (from === to) return full.format(utc(from));
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))} – ${full.format(utc(to))}`;
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? dayMonth.format(utc(from)) : full.format(utc(from))} – ${full.format(utc(to))}`;
}

/** Quick periods of the reports (they end today: the future has no sales). */
export function reportPresets(today = businessToday()): DatePreset[] {
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const lastMonthEnd = addDays(firstOfMonth, -1);
  const preset = (label: string, shortcut: string, { from, to }: ReportPeriod) => ({
    label,
    shortcut,
    from: toLocalDate(from),
    to: toLocalDate(to),
  });
  return [
    preset("Hoje", "h", lastDays(1, today)),
    preset("Ontem", "o", { from: addDays(today, -1), to: addDays(today, -1) }),
    preset("Últimos 7 dias", "s", lastDays(7, today)),
    preset("Últimos 30 dias", "u", lastDays(30, today)),
    preset("Últimos 90 dias", "t", lastDays(90, today)),
    preset("Este mês", "m", { from: firstOfMonth, to: today }),
    preset("Mês passado", "p", { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd }),
    preset("Este ano", "a", { from: `${today.slice(0, 4)}-01-01`, to: today }),
  ];
}
