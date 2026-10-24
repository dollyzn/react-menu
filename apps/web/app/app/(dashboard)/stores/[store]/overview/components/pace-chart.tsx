"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { DashboardToday } from "@react-menu/contracts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatCurrencyBRL } from "@/utils/string";

const config = {
  today: { label: "Hoje", color: "var(--primary)" },
  lastWeek: { label: "Semana passada", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const compactBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** The same weekday a week before `date`: "sexta passada" / "na sexta passada", "sábado passado" / "no sábado passado". */
export function sameDayLastWeek(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const name = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`))
    .replace("-feira", "");
  const masculine = day === 0 || day === 6;
  const label = `${name} passad${masculine ? "o" : "a"}`;
  return { label, on: `${masculine ? "no" : "na"} ${label}` };
}

type Point = DashboardToday["pace"][number];

/** Hours worth showing: from the first sale (either day) to the last one or now. */
function window(pace: Point[]) {
  const moved = (index: number) =>
    (pace[index].today ?? 0) !== (pace[index - 1]?.today ?? 0) ||
    pace[index].lastWeek !== (pace[index - 1]?.lastWeek ?? 0);
  const active = pace.map((_, index) => index).filter(moved);
  const now = pace.findLastIndex((point) => point.today !== null);
  if (active.length === 0) return pace.slice(Math.max(0, now - 6), Math.max(now + 1, 7));
  const start = Math.max(0, Math.min(...active) - 1);
  const end = Math.min(23, Math.max(Math.max(...active), now) + 1);
  return pace.slice(start, end + 1);
}

function LineKey({ color, muted }: { color: string; muted?: boolean }) {
  return <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: color, opacity: muted ? 0.6 : 1 }} />;
}

export function PaceChart({ data }: { data: DashboardToday }) {
  const points = window(data.pace);
  const { label: lastWeekLabel, on: onLastWeek } = sameDayLastWeek(data.date);
  const nowHour = data.pace.findLastIndex((point) => point.today !== null);
  const lastWeekNow = data.pace[nowHour]?.lastWeek ?? 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Ritmo de vendas</CardTitle>
        <CardDescription>
          Faturamento acumulado: {formatCurrencyBRL(data.sales.revenue)} até agora,{" "}
          {formatCurrencyBRL(lastWeekNow)} {onLastWeek} a esta hora
        </CardDescription>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <LineKey color="var(--primary)" />
            Hoje
          </span>
          <span className="inline-flex items-center gap-1.5 first-letter:uppercase">
            <LineKey color="var(--muted-foreground)" muted />
            {lastWeekLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={config} className="aspect-auto h-60 w-full">
          <LineChart data={points} margin={{ left: 0, right: 12, top: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              tickFormatter={(hour: number) => `${hour}h`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value: number) => compactBRL.format(value)}
            />
            <ChartTooltip
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                if (!point) return null;
                return (
                  <div className="grid min-w-44 gap-1 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                    <span className="text-muted-foreground">Até as {point.hour + 1}h</span>
                    {point.today !== null && (
                      <span className="flex items-center gap-2">
                        <LineKey color="var(--primary)" />
                        <span className="text-sm font-semibold tabular-nums">{formatCurrencyBRL(point.today)}</span>
                        <span className="text-muted-foreground">hoje</span>
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <LineKey color="var(--muted-foreground)" muted />
                      <span className="text-sm font-semibold tabular-nums">{formatCurrencyBRL(point.lastWeek)}</span>
                      <span className="text-muted-foreground">{lastWeekLabel}</span>
                    </span>
                  </div>
                );
              }}
            />
            <Line
              dataKey="lastWeek"
              type="monotone"
              stroke="var(--color-lastWeek)"
              strokeOpacity={0.6}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
            <Line
              dataKey="today"
              type="monotone"
              stroke="var(--color-today)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          </LineChart>
        </ChartContainer>
        <table className="sr-only">
          <caption>Faturamento acumulado por hora</caption>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Hoje</th>
              <th scope="col">{lastWeekLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.hour}>
                <th scope="row">{`até ${point.hour + 1}h`}</th>
                <td>{point.today === null ? "—" : formatCurrencyBRL(point.today)}</td>
                <td>{formatCurrencyBRL(point.lastWeek)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
