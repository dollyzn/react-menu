"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { SalesReport } from "@react-menu/contracts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatDay, formatWeekday } from "@/lib/report-period";
import { formatCurrencyBRL } from "@/utils/string";

const config = {
  revenue: { label: "Faturamento", color: "var(--primary)" },
  orders: { label: "Pedidos", color: "var(--primary)" },
} satisfies ChartConfig;

const compactBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const orders = (value: number) => (value === 1 ? "1 pedido" : `${value} pedidos`);

/** Value first (strong), what it is after (muted). */
function TooltipCard({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <div className="grid min-w-36 gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <span className="text-muted-foreground">{title}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      {detail && <span className="text-muted-foreground">{detail}</span>}
    </div>
  );
}

type Day = SalesReport["daily"][number];
type Hour = SalesReport["hourly"][number];

/** Bars up to ~6 weeks; a line beyond that (bars get too thin). */
export function DailyRevenueChart({ daily }: { daily: Day[] }) {
  const best = daily.reduce<Day | null>((top, day) => (day.revenue > (top?.revenue ?? 0) ? day : top), null);
  const asLine = daily.length > 45;
  const axes = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis
        dataKey="date"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={24}
        tickFormatter={(value: string) => formatDay(value)}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={64}
        tickFormatter={(value: number) => compactBRL.format(value)}
      />
      <ChartTooltip
        cursor={asLine ? true : { fillOpacity: 0.6 }}
        content={({ active, payload }) => {
          const day = active ? (payload?.[0]?.payload as Day | undefined) : undefined;
          return day ? (
            <TooltipCard title={formatWeekday(day.date)} value={formatCurrencyBRL(day.revenue)} detail={orders(day.orders)} />
          ) : null;
        }}
      />
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturamento por dia</CardTitle>
        <CardDescription>
          {best ? `Melhor dia: ${formatWeekday(best.date)} · ${formatCurrencyBRL(best.revenue)}` : "Sem vendas no período"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          {asLine ? (
            <AreaChart data={daily} margin={{ left: 0, right: 8, top: 8 }} accessibilityLayer>
              {axes}
              <Area
                dataKey="revenue"
                type="monotone"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                fill="var(--color-revenue)"
                fillOpacity={0.1}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              />
            </AreaChart>
          ) : (
            <BarChart data={daily} margin={{ left: 0, right: 8, top: 8 }} accessibilityLayer>
              {axes}
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          )}
        </ChartContainer>
        <table className="sr-only">
          <caption>Faturamento e pedidos por dia</caption>
          <tbody>
            {daily.map((day) => (
              <tr key={day.date}>
                <th scope="row">{formatWeekday(day.date)}</th>
                <td>{formatCurrencyBRL(day.revenue)}</td>
                <td>{orders(day.orders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** Only the hours with orders (and a little around them), so the bars stay readable. */
function busyHours(hourly: Hour[]) {
  const busy = hourly.filter((hour) => hour.orders > 0).map((hour) => hour.hour);
  if (busy.length === 0) return hourly;
  let start = Math.max(0, Math.min(...busy) - 1);
  let end = Math.min(23, Math.max(...busy) + 1);
  while (end - start < 7) {
    if (start > 0) start--;
    if (end - start < 7 && end < 23) end++;
  }
  return hourly.slice(start, end + 1);
}

export function HourlyOrdersChart({ hourly }: { hourly: Hour[] }) {
  const hours = busyHours(hourly);
  const peak = hourly.reduce<Hour | null>((top, hour) => (hour.orders > (top?.orders ?? 0) ? hour : top), null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos por horário</CardTitle>
        <CardDescription>
          {peak ? `Pico: ${peak.hour}h às ${peak.hour + 1}h · ${orders(peak.orders)}` : "Sem pedidos no período"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={hours} margin={{ left: 0, right: 8, top: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              tickFormatter={(value: number) => `${value}h`}
            />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip
              cursor={{ fillOpacity: 0.6 }}
              content={({ active, payload }) => {
                const hour = active ? (payload?.[0]?.payload as Hour | undefined) : undefined;
                return hour ? (
                  <TooltipCard title={`${hour.hour}h às ${hour.hour + 1}h`} value={orders(hour.orders)} />
                ) : null;
              }}
            />
            <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartContainer>
        <table className="sr-only">
          <caption>Pedidos em cada horário</caption>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour.hour}>
                <th scope="row">{`${hour.hour}h às ${hour.hour + 1}h`}</th>
                <td>{orders(hour.orders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
