"use client";

import { useParams } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
      <div className="flex items-center justify-between space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/app/stores/${store}`}>
                Loja
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Visão Geral</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

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
