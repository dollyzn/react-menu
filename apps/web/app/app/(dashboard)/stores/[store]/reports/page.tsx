"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { ChartNoAxesColumn, Download, RotateCw } from "lucide-react";
import type { SalesReport } from "@react-menu/contracts";
import { PageHeader } from "@/components/app/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv } from "@/lib/csv";
import { businessToday, customPeriod, formatPeriod, lastDays, type ReportPeriod } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { useGetSalesReportQuery } from "@/redux/features/report/reportApi";
import { formatQuantity } from "@/utils/units";
import { formatCurrencyBRL } from "@/utils/string";
import { CHECKOUT_METHODS } from "@/app/(menu)/_lib/payment-methods";
import { PeriodFilter } from "./components/period-filter";
import { RankedList, type RankedRow } from "@/components/app/ranked-list";
import { DailyRevenueChart, HourlyOrdersChart } from "./components/sales-charts";
import { StatTiles } from "./components/stat-tiles";

const share = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const orderCount = (value: number) => (value === 1 ? "1 pedido" : `${value} pedidos`);

const PAYMENT_LABELS: Record<SalesReport["payments"][number]["method"], string> = {
  pix: CHECKOUT_METHODS.pix.label,
  card: CHECKOUT_METHODS.card.label,
  counter: "No balcão",
  mercado_pago: "Mercado Pago",
};
const CHANNEL_LABELS: Record<SalesReport["channels"][number]["channel"], string> = {
  online: "Cardápio online",
  pos: "Balcão (PDV)",
};

/** Period from the URL (`?de=…&ate=…`), the last 30 days by default. */
function usePeriod() {
  const params = useSearchParams();
  const pathname = usePathname();
  const today = businessToday();
  const period = customPeriod(params.get("de"), params.get("ate")) ?? lastDays(30, today);
  return {
    today,
    period,
    // null state: Next syncs useSearchParams only for app-made history entries.
    choose: ({ from, to }: ReportPeriod) =>
      window.history.replaceState(null, "", `${pathname}?${new URLSearchParams({ de: from, ate: to })}`),
  };
}

function ExportMenu({ report }: { report: SalesReport | undefined }) {
  const suffix = report ? `${report.period.from}-a-${report.period.to}` : "";
  const exports = report
    ? [
        {
          label: "Vendas por dia",
          run: () =>
            downloadCsv(
              `vendas-por-dia-${suffix}.csv`,
              ["Data", "Pedidos", "Faturamento (R$)"],
              report.daily.map((day) => [day.date, day.orders, day.revenue])
            ),
        },
        {
          label: "Itens vendidos",
          run: () =>
            downloadCsv(
              `itens-vendidos-${suffix}.csv`,
              ["Item", "Quantidade", "Faturamento (R$)"],
              report.items.map((item) => [item.name, item.quantity, item.revenue])
            ),
        },
        {
          label: "Adicionais e escolhas",
          run: () =>
            downloadCsv(
              `adicionais-${suffix}.csv`,
              ["Adicional", "Quantidade", "Faturamento (R$)"],
              report.addons.map((addon) => [addon.name, addon.quantity, addon.revenue])
            ),
        },
        {
          label: "Consumo de estoque",
          run: () =>
            downloadCsv(
              `consumo-de-estoque-${suffix}.csv`,
              ["Ingrediente", "Consumido", "Unidade"],
              report.stock.map((row) => [row.name, row.consumed, row.unit])
            ),
        },
      ]
    : [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={!report} />}>
        <Download />
        Exportar CSV
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {exports.map((item) => (
          <DropdownMenuItem key={item.label} onClick={item.run}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando relatório">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
      </div>
    </div>
  );
}

function Report({ report }: { report: SalesReport }) {
  const { summary } = report;
  const singleDay = report.period.days === 1;

  if (summary.orders === 0) {
    return (
      <div className="space-y-4">
        <StatTiles report={report} />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartNoAxesColumn />
            </EmptyMedia>
            <EmptyTitle>Nenhuma venda neste período</EmptyTitle>
            <EmptyDescription>
              Os gráficos aparecem quando houver pedidos pagos ou feitos no balcão. Escolha outro período acima.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const items: RankedRow[] = report.items.map((item) => ({
    key: item.name,
    label: item.name,
    amount: item.quantity,
    value: `${item.quantity.toLocaleString("pt-BR")} un`,
    detail: formatCurrencyBRL(item.revenue),
  }));
  const addons: RankedRow[] = report.addons.map((addon) => ({
    key: addon.name,
    label: addon.name,
    amount: addon.quantity,
    value: `${addon.quantity.toLocaleString("pt-BR")}×`,
    detail: addon.revenue > 0 ? formatCurrencyBRL(addon.revenue) : "incluso",
  }));
  const mix = <T,>(rows: (T & { orders: number; revenue: number })[], label: (row: T) => string) =>
    [...rows]
      .sort((a, b) => b.revenue - a.revenue)
      .map((row) => ({
        key: label(row),
        label: label(row),
        amount: row.revenue,
        value: share.format(summary.revenue ? row.revenue / summary.revenue : 0),
        detail: `${formatCurrencyBRL(row.revenue)} · ${orderCount(row.orders)}`,
      }));
  const stock: RankedRow[] = report.stock.map((row) => ({
    key: row.ingredientId,
    label: (
      <>
        {row.icon && <span className="mr-1.5 font-emoji">{row.icon}</span>}
        {row.name}
      </>
    ),
    amount: row.consumed,
    value: formatQuantity(row.consumed, row.unit),
  }));

  return (
    <div className="space-y-4">
      <StatTiles report={report} />

      <div className="grid gap-4 lg:grid-cols-5">
        {!singleDay && (
          <div className="min-w-0 lg:col-span-3">
            <DailyRevenueChart daily={report.daily} />
          </div>
        )}
        <div className={cn("min-w-0", singleDay ? "lg:col-span-5" : "lg:col-span-2")}>
          <HourlyOrdersChart hourly={report.hourly} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Mais vendidos" description="Unidades vendidas e o que renderam">
          <RankedList rows={items} label="Itens mais vendidos" empty="Nenhum item vendido." />
        </Section>
        <Section title="Adicionais e escolhas" description="Os mais pedidos junto com os itens">
          <RankedList rows={addons} label="Adicionais mais pedidos" empty="Nenhum adicional pedido." />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Formas de pagamento" description="Parte do faturamento">
          <RankedList
            rows={mix(report.payments, (row) => PAYMENT_LABELS[row.method])}
            label="Faturamento por forma de pagamento"
            empty="Sem pagamentos."
          />
        </Section>
        <Section title="Canais de venda" description="Cardápio online × balcão">
          <RankedList
            rows={mix(report.channels, (row) => CHANNEL_LABELS[row.channel])}
            label="Faturamento por canal"
            empty="Sem vendas."
          />
        </Section>
        <Section title="Consumo de estoque" description="O que as vendas gastaram (descontados os cancelamentos)">
          <RankedList
            rows={stock}
            bars={false}
            label="Consumo de ingredientes"
            empty="Nenhum ingrediente com receita foi consumido."
          />
        </Section>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { store } = useParams();
  const storeId = store as string;
  const { today, period, choose } = usePeriod();
  const { data, isLoading, isFetching, isError, refetch } = useGetSalesReportQuery(
    { storeId, ...period },
    { refetchOnMountOrArgChange: 30 }
  );
  // A previous period's report stays on screen (dimmed) while the new one loads.
  const stale = isFetching && !!data && (data.period.from !== period.from || data.period.to !== period.to);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Relatórios"
        description="Vendas, mais vendidos, pagamentos e consumo de estoque."
        actions={<ExportMenu report={data} />}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PeriodFilter period={period} today={today} onChange={choose} />
        {data && (
          <p className="text-sm text-muted-foreground">comparado com {formatPeriod(data.previousPeriod)}</p>
        )}
      </div>

      {isError && !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Não foi possível carregar o relatório</EmptyTitle>
            <EmptyDescription>Confira a conexão e tente de novo.</EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCw />
            Tentar de novo
          </Button>
        </Empty>
      ) : !data || isLoading ? (
        <ReportSkeleton />
      ) : (
        <div className={cn("transition-opacity", stale && "pointer-events-none opacity-60")} aria-busy={stale}>
          <Report report={data} />
        </div>
      )}
    </div>
  );
}
