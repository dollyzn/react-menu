import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/**
 * Change against a reference ("vs. período anterior"); up is good. `against`
 * names the reference, `shortAgainst` replaces it on phones.
 */
export function Delta({
  current,
  previous,
  against = "vs. período anterior",
  shortAgainst = "vs. anterior",
  empty = "sem vendas no período anterior",
}: {
  current: number;
  previous: number;
  against?: string;
  shortAgainst?: string;
  /** Shown when there is nothing to compare with. */
  empty?: string;
}) {
  if (previous === 0) {
    return current > 0 ? <span className="text-xs text-muted-foreground">{empty}</span> : null;
  }
  const change = (current - previous) / previous;
  const flat = Math.abs(change) < 0.005;
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
          flat
            ? "bg-muted text-foreground"
            : change > 0
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive"
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {flat ? "igual" : `${change > 0 ? "+" : "−"}${percent.format(Math.abs(change))}`}
      </span>
      <span className="hidden sm:inline">{against}</span>
      <span className="sm:hidden">{shortAgainst}</span>
    </span>
  );
}

/** A 2px trend line of the period, no axes (details are in the charts below). */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 3) return null;
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 28;
  const points = values.map((value, index) => [
    (index / (values.length - 1)) * width,
    height - 2 - (value / max) * (height - 4),
  ]);
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-7 w-full text-primary"
      role="img"
      aria-label={label}
    >
      <polygon points={`0,${height} ${line} ${width},${height}`} className="fill-current opacity-10" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  children,
  className,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="flex h-full flex-col gap-1.5 px-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight sm:text-3xl">{value}</span>
        {children}
      </CardContent>
    </Card>
  );
}
