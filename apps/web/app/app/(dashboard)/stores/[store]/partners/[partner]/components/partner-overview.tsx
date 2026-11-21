"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Delta, Sparkline, StatTile } from "@/components/app/stat-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { businessToday, customPeriod, lastDays, type ReportPeriod } from "@/lib/report-period";
import { useGetPartnerStatsQuery } from "@/redux/features/partner/partnersApi";
import { CommissionState } from "@/components/app/partner/commission-state";
import { formatCurrencyBRL } from "@/utils/string";
import { PeriodFilter } from "../../../reports/components/period-filter";
import { DailyRevenueChart } from "../../../reports/components/sales-charts";

const count = new Intl.NumberFormat("pt-BR");

/** The period in the URL (`?de=…&ate=…`), the last 30 days by default (like the reports). */
function usePeriod() {
  const params = useSearchParams();
  const pathname = usePathname();
  const today = businessToday();
  const period = customPeriod(params.get("de"), params.get("ate")) ?? lastDays(30, today);
  return {
    today,
    period,
    choose: ({ from, to }: ReportPeriod) => {
      const next = new URLSearchParams(window.location.search);
      next.set("de", from);
      next.set("ate", to);
      // null state: Next syncs useSearchParams only for app-made history entries.
      window.history.replaceState(null, "", `${pathname}?${next}`);
    },
  };
}

/** A partner's period at a glance: the tiles of the reports, sales per day, and the commission's state. */
export function PartnerOverview({ storeId, partnerId }: { storeId: string; partnerId: string }) {
  const { today, period, choose } = usePeriod();
  const { data: stats, isFetching } = useGetPartnerStatsQuery({ storeId, partnerId, ...period });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter period={period} today={today} onChange={choose} />
      </div>
      {!stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={isFetching ? "flex flex-col gap-4 opacity-70 transition-opacity" : "flex flex-col gap-4 transition-opacity"}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Vendas" value={formatCurrencyBRL(stats.current.sales)}>
              <Delta current={stats.current.sales} previous={stats.previous.sales} />
              <div className="mt-auto pt-2">
                <Sparkline values={stats.daily.map((day) => day.sales)} label="Tendência das vendas no período" />
              </div>
            </StatTile>
            <StatTile label="Pedidos" value={count.format(stats.current.orders)}>
              <Delta current={stats.current.orders} previous={stats.previous.orders} />
              <div className="mt-auto pt-2">
                <Sparkline values={stats.daily.map((day) => day.orders)} label="Tendência dos pedidos no período" />
              </div>
            </StatTile>
            <StatTile label="Comissão" value={formatCurrencyBRL(stats.current.commission)}>
              <Delta current={stats.current.commission} previous={stats.previous.commission} />
            </StatTile>
            <StatTile label="Ticket médio" value={formatCurrencyBRL(stats.current.averageTicket)}>
              <Delta current={stats.current.averageTicket} previous={stats.previous.averageTicket} />
            </StatTile>
          </div>
          <DailyRevenueChart
            title="Vendas por dia"
            caption="Vendas, pedidos e comissão por dia"
            daily={stats.daily.map((day) => ({ date: day.date, revenue: day.sales, orders: day.orders }))}
            detail={(day) =>
              `comissão ${formatCurrencyBRL(stats.daily.find((candidate) => candidate.date === day.date)?.commission ?? 0)}`
            }
          />
          <CommissionState totals={stats.totals} />
        </div>
      )}
    </div>
  );
}
