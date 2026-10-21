"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/app/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewInfo } from "./components/overview-info";
import { OverviewBarChart } from "./components/overview-bar-chart";
import { OverviewAreaChart } from "./components/overview-area-chart";
import { RecentItems } from "./components/recent-items";
import { useGetStoreChartQuery } from "@/redux/features/store/storeApi";

export default function Overview() {
  const { store } = useParams();
  const storeId = store as string;
  const {
    data: chartData,
    isLoading,
    isFetching,
  } = useGetStoreChartQuery(storeId);
  const loadingChart = isLoading || (isFetching && !chartData);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="Visão geral" description="Visitas ao cardápio e números da loja." />

      <OverviewInfo
        storeId={storeId}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <OverviewBarChart
          storeId={storeId}
          chartData={chartData}
          loading={loadingChart}
          className="lg:col-span-4"
        />

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Itens Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RecentItems storeId={storeId} />
          </CardContent>
        </Card>
      </div>

      <OverviewAreaChart
        storeId={storeId}
        chartData={chartData}
        loading={loadingChart}
      />
    </div>
  );
}
