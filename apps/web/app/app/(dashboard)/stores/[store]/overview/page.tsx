"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  ChartNoAxesColumn,
  ChefHat,
  CircleCheck,
  Clock,
  ImageOff,
  Inbox,
  PackageCheck,
  PauseCircle,
  PackageX,
  RotateCw,
} from "lucide-react";
import { Bar, BarChart, XAxis } from "recharts";
import type { DashboardToday } from "@react-menu/contracts";
import { PageHeader } from "@/components/app/layout/page-header";
import { RankedList } from "@/components/app/ranked-list";
import { Delta, StatTile, percent } from "@/components/app/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWhen } from "@/lib/opening-hours";
import { formatWeekday } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { useGetDashboardTodayQuery } from "@/redux/features/report/reportApi";
import { formatQuantity } from "@/utils/units";
import { formatCurrencyBRL } from "@/utils/string";
import { PaceChart, sameDayLastWeek } from "./components/pace-chart";

const count = new Intl.NumberFormat("pt-BR");
const plural = (value: number, one: string, many: string) => `${count.format(value)} ${value === 1 ? one : many}`;

function StoreStatus({ store }: { store: DashboardToday["store"] }) {
  return (
    <Badge variant="outline" className="h-8 gap-2 px-3 text-sm font-normal">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", store.isOpen ? "bg-emerald-500" : "bg-muted-foreground")}
      />
      {store.isOpen
        ? `Aberta${store.closesAt ? ` · fecha ${formatWhen(store.closesAt)}` : ""}`
        : `Fechada${store.opensAt ? ` · abre ${formatWhen(store.opensAt)}` : ""}`}
    </Badge>
  );
}

function SalesTiles({ data }: { data: DashboardToday }) {
  const { sales, kitchen } = data;
  const { label } = sameDayLastWeek(data.date);
  const lastWeekTicket = sales.lastWeek.orders ? sales.lastWeek.revenue / sales.lastWeek.orders : 0;
  const against = `vs. ${label} até esta hora`;
  const shortAgainst = `vs. ${label}`;
  const empty = `sem vendas ${sameDayLastWeek(data.date).on}`;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Faturamento hoje" value={formatCurrencyBRL(sales.revenue)}>
        <Delta current={sales.revenue} previous={sales.lastWeek.revenue} {...{ against, shortAgainst, empty }} />
      </StatTile>
      <StatTile label="Pedidos hoje" value={count.format(sales.orders)}>
        <Delta current={sales.orders} previous={sales.lastWeek.orders} {...{ against, shortAgainst, empty }} />
      </StatTile>
      <StatTile label="Ticket médio" value={formatCurrencyBRL(sales.averageTicket)}>
        <Delta current={sales.averageTicket} previous={lastWeekTicket} {...{ against, shortAgainst, empty }} />
      </StatTile>
      <StatTile label="Tempo de preparo" value={kitchen.averageMinutes === null ? "—" : `${kitchen.averageMinutes} min`}>
        <span className="text-xs text-muted-foreground">
          {kitchen.orders
            ? `média de ${plural(kitchen.orders, "pedido pronto", "pedidos prontos")} hoje`
            : "nenhum pedido pronto hoje"}
        </span>
      </StatTile>
    </div>
  );
}

function QueueCard({ data, base }: { data: DashboardToday; base: string }) {
  const { queue } = data;
  const steps = [
    { label: "Aguardando pagamento", value: queue.pendingPayment, icon: Clock },
    { label: "Recebidos", value: queue.received, icon: Inbox },
    { label: "Em preparo", value: queue.preparing, icon: ChefHat },
    { label: "Prontos para retirar", value: queue.ready, icon: PackageCheck },
  ];
  const open = queue.received + queue.preparing + queue.ready;
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Pedidos agora</CardTitle>
        <CardDescription>
          {open ? `${plural(open, "pedido", "pedidos")} em andamento` : "Nenhum pedido em andamento"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <ul className="grid flex-1 grid-cols-2 gap-2" aria-label="Pedidos por etapa">
          {steps.map(({ label, value, icon: Icon }) => (
            <li key={label} className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <span className="flex size-8 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-2xl font-semibold">{count.format(value)}</span>
                <span className="block text-xs text-muted-foreground">{label}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link href={`${base}/orders`} className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
          Abrir pedidos
          <ArrowRight />
        </Link>
      </CardContent>
    </Card>
  );
}

const visitsConfig = { visits: { label: "Visitas", color: "var(--primary)" } } satisfies ChartConfig;

function VisitsCard({ data }: { data: DashboardToday }) {
  const { visits } = data;
  const { label } = sameDayLastWeek(data.date);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Cardápio online</CardTitle>
        <CardDescription>Visitas e quantas viraram pedido</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <span className="text-sm text-muted-foreground">Visitas hoje</span>
            <span className="text-2xl font-semibold">{count.format(visits.today)}</span>
            <Delta
              current={visits.today}
              previous={visits.lastWeek}
              against={`vs. ${label}`}
              shortAgainst={`vs. ${label}`}
              empty={`nenhuma ${sameDayLastWeek(data.date).on}`}
            />
          </div>
          <div className="grid content-start gap-1">
            <span className="text-sm text-muted-foreground">Conversão</span>
            <span className="text-2xl font-semibold">
              {visits.conversion === null ? "—" : percent.format(visits.conversion)}
            </span>
            <span className="text-xs text-muted-foreground">
              {plural(visits.onlineOrders, "pedido online", "pedidos online")}
            </span>
          </div>
        </div>
        <div className="mt-auto">
          <span className="text-xs text-muted-foreground">Últimos 14 dias</span>
          <ChartContainer config={visitsConfig} className="aspect-auto h-24 w-full">
            <BarChart data={visits.daily} margin={{ left: 0, right: 0, top: 4, bottom: 0 }} accessibilityLayer>
              <XAxis dataKey="date" hide />
              <ChartTooltip
                cursor={{ fillOpacity: 0.6 }}
                content={({ active, payload }) => {
                  const day = active ? (payload?.[0]?.payload as DashboardToday["visits"]["daily"][number]) : undefined;
                  return day ? (
                    <div className="grid gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                      <span className="text-muted-foreground">{formatWeekday(day.date)}</span>
                      <span className="text-sm font-semibold tabular-nums">{plural(day.visits, "visita", "visitas")}</span>
                    </div>
                  ) : null;
                }}
              />
              <Bar dataKey="visits" fill="var(--color-visits)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ChartContainer>
          <table className="sr-only">
            <caption>Visitas nos últimos 14 dias</caption>
            <tbody>
              {visits.daily.map((day) => (
                <tr key={day.date}>
                  <th scope="row">{formatWeekday(day.date)}</th>
                  <td>{plural(day.visits, "visita", "visitas")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionCard({ data, base }: { data: DashboardToday; base: string }) {
  const { menu, lowStock } = data;
  const alerts = [
    menu.soldOut > 0 && {
      key: "sold-out",
      icon: PackageX,
      text: `${plural(menu.soldOut, "item esgotado", "itens esgotados")} pelo estoque`,
      href: `${base}/inventory`,
      action: "Repor",
    },
    menu.paused > 0 && {
      key: "paused",
      icon: PauseCircle,
      text: `${plural(menu.paused, "item pausado", "itens pausados")} no cardápio`,
      href: `${base}/items`,
      action: "Ver itens",
    },
    menu.withoutPhoto > 0 && {
      key: "photo",
      icon: ImageOff,
      text: `${plural(menu.withoutPhoto, "item", "itens")} sem foto`,
      href: `${base}/items`,
      action: "Ver itens",
    },
  ].filter((alert) => !!alert);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Precisa de atenção</CardTitle>
        <CardDescription>Estoque baixo e itens que não vendem</CardDescription>
      </CardHeader>
      <CardContent className="grid content-start gap-4">
        {lowStock.length === 0 && alerts.length === 0 && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Tudo certo por aqui.
          </p>
        )}
        {lowStock.length > 0 && (
          <div className="grid gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Estoque no mínimo
            </span>
            <ul className="grid gap-1.5" aria-label="Ingredientes no estoque mínimo">
              {lowStock.slice(0, 5).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {row.icon && <span className="mr-1.5 font-emoji">{row.icon}</span>}
                    {row.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    <span className={cn("font-semibold", row.stockQuantity <= 0 ? "text-destructive" : "text-foreground")}>
                      {formatQuantity(row.stockQuantity, row.unit)}
                    </span>{" "}
                    de {formatQuantity(row.minStock, row.unit)}
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`${base}/inventory`} className="text-sm font-medium text-primary hover:underline">
              {lowStock.length > 5 ? `Ver os ${lowStock.length} no estoque` : "Abrir estoque"}
            </Link>
          </div>
        )}
        {alerts.length > 0 && (
          <ul className="grid gap-2" aria-label="Avisos do cardápio">
            {alerts.map(({ key, icon: Icon, text, href, action }) => (
              <li key={key} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">{text}</span>
                <Link href={href} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  {action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando visão geral">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}

export default function Overview() {
  const { store } = useParams();
  const storeId = store as string;
  const base = `/app/stores/${storeId}`;
  const { data, isError, refetch } = useGetDashboardTodayQuery(storeId, {
    // Orders arrive over realtime; this catches the clock (visits, the hour).
    pollingInterval: 60_000,
    refetchOnMountOrArgChange: true,
  });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Visão geral"
        description="Como a loja está hoje, ao vivo."
        actions={
          <>
            {data && <StoreStatus store={data.store} />}
            <Link href={`${base}/reports`} className={buttonVariants({ variant: "outline" })}>
              <ChartNoAxesColumn />
              Relatórios
            </Link>
          </>
        }
      />

      {isError && !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Não foi possível carregar a visão geral</EmptyTitle>
            <EmptyDescription>Confira a conexão e tente de novo.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCw />
            Tentar de novo
          </Button>
        </Empty>
      ) : !data ? (
        <OverviewSkeleton />
      ) : (
        <div className="space-y-4">
          <SalesTiles data={data} />
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              <PaceChart data={data} />
            </div>
            <div className="min-w-0 lg:col-span-2">
              <QueueCard data={data} base={base} />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <VisitsCard data={data} />
            <Card>
              <CardHeader>
                <CardTitle>Mais pedidos hoje</CardTitle>
                <CardDescription>Unidades vendidas</CardDescription>
              </CardHeader>
              <CardContent>
                <RankedList
                  rows={data.topItems.map((item) => ({
                    key: item.name,
                    label: item.name,
                    amount: item.quantity,
                    value: `${count.format(item.quantity)} un`,
                  }))}
                  label="Itens mais pedidos hoje"
                  empty="Nenhuma venda ainda hoje."
                />
              </CardContent>
            </Card>
            <AttentionCard data={data} base={base} />
          </div>
        </div>
      )}
    </div>
  );
}
