import type { OpeningInterval } from "@react-menu/contracts";

/** The stores' timezone (the API computes opening hours in it too). */
export const BUSINESS_TIMEZONE = "America/Sao_Paulo";

/** Index = `day` of an OpeningInterval (0 = Sunday). */
export const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Monday first, like a Brazilian calendar. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date
  );
const time = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);

/** "às 18:00", "amanhã às 10:00", "sábado às 18:00" (in the store's timezone). */
export function formatWhen(iso: string, now = new Date()) {
  const date = new Date(iso);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dayKey(date) === dayKey(now)) return `às ${time(date)}`;
  if (dayKey(date) === dayKey(tomorrow)) return `amanhã às ${time(date)}`;
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TIMEZONE, weekday: "long" }).format(date);
  return `${weekday.replace("-feira", "")} às ${time(date)}`;
}

/** "18:00 – 23:00, 23:30 – 02:00" for one day, or "Fechado". */
export function dayHours(hours: OpeningInterval[], day: number) {
  const ofDay = hours.filter((interval) => interval.day === day).sort((a, b) => a.opens.localeCompare(b.opens));
  return ofDay.length ? ofDay.map((interval) => `${interval.opens} – ${interval.closes}`).join(", ") : "Fechado";
}
