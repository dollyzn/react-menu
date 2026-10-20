"use client";

import { useMemo, useState } from "react";
import { useGetStoreChartQuery } from "@/redux/features/store/storeApi";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { cn } from "@/lib/utils";
dayjs.locale("pt-br");

const chartConfig = {
  accesses: {
    label: "Acessos",
  },
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

interface OverviewBarChartProps {
  className?: string;
  storeId: string;
  chartData?: { date: string; desktop: number; mobile: number }[];
  loading?: boolean;
}

export function OverviewBarChart({
  className,
  storeId,
  chartData,
  loading: loadingProp,
}: OverviewBarChartProps) {
  const { data, isLoading, isFetching } = useGetStoreChartQuery(storeId, {
    skip: !!chartData,
  });
  const resolvedData = chartData ?? data;
  const loading = loadingProp ?? (isLoading || (isFetching && !resolvedData));

  const [activeChart, setActiveChart] =
    useState<keyof typeof chartConfig>("desktop");

  const total = useMemo(
    () => ({
      desktop: resolvedData?.reduce((acc, curr) => acc + curr.desktop, 0) || 0,
      mobile: resolvedData?.reduce((acc, curr) => acc + curr.mobile, 0) || 0,
    }),
    [resolvedData]
  );

  return (
    <Card className={cn("py-0", className)}>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>Visão Geral</CardTitle>
          <CardDescription>
            Total de acessos dos últimos 3 meses
          </CardDescription>
        </div>
        <div className="flex">
          {["desktop", "mobile"].map((key) => {
            const chartKey = key as keyof typeof chartConfig;
            return (
              <button
                key={chartKey}
                data-active={activeChart === chartKey}
                className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
                onClick={() => setActiveChart(chartKey)}
              >
                <span className="text-xs text-muted-foreground">
                  {chartConfig[chartKey].label}
                </span>
                {(loading && !resolvedData) || !resolvedData ? (
                  <Skeleton className="h-8 w-14" />
                ) : (
                  <span className="text-lg font-bold leading-none sm:text-3xl">
                    {total[key as keyof typeof total].toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        {(loading && !resolvedData) || !resolvedData ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[300px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={resolvedData}
              dataKey={activeChart}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = dayjs(value);
                  return date.format("D [de] MMM[.]");
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[150px]"
                    nameKey="accesses"
                    labelFormatter={(value) => {
                      const date = dayjs(value);
                      return date.format("D [de] MMM[.] [de] YYYY");
                    }}
                  />
                }
              />
              <Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
