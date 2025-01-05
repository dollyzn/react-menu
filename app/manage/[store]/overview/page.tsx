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

export default function Overview() {
  const { store } = useParams();

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/manage/${store}`}>Loja</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Visão Geral</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <OverviewInfo className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <OverviewBarChart className="lg:col-span-4" />

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Itens Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <RecentItems />
          </CardContent>
        </Card>
      </div>

      <OverviewAreaChart />
    </div>
  );
}
