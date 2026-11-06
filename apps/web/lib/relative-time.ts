const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Infinity],
];

/** "agora", "há 5 minutos", "ontem", "há 3 semanas" (client-side only: it reads the clock). */
export function timeAgo(iso: string, now = Date.now()) {
  let value = (new Date(iso).getTime() - now) / 1000;
  if (Math.abs(value) < 45) return "agora";
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return relative.format(Math.round(value), "year");
}
