import type { SalesReport } from "@react-menu/contracts";
import { Delta, Sparkline, StatTile } from "@/components/app/stat-tile";
import { formatCurrencyBRL } from "@/utils/string";

const count = new Intl.NumberFormat("pt-BR");

export function StatTiles({ report }: { report: SalesReport }) {
  const { summary, daily } = report;
  const previousTicket = summary.previous.orders ? summary.previous.revenue / summary.previous.orders : 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Faturamento" value={formatCurrencyBRL(summary.revenue)}>
        <Delta current={summary.revenue} previous={summary.previous.revenue} />
        <div className="mt-auto pt-2">
          <Sparkline values={daily.map((day) => day.revenue)} label="Tendência do faturamento no período" />
        </div>
      </StatTile>
      <StatTile label="Pedidos" value={count.format(summary.orders)}>
        <Delta current={summary.orders} previous={summary.previous.orders} />
        <div className="mt-auto pt-2">
          <Sparkline values={daily.map((day) => day.orders)} label="Tendência dos pedidos no período" />
        </div>
      </StatTile>
      <StatTile label="Ticket médio" value={formatCurrencyBRL(summary.averageTicket)}>
        <Delta current={summary.averageTicket} previous={previousTicket} />
      </StatTile>
      <StatTile label="Itens vendidos" value={count.format(summary.units)}>
        <span className="text-xs text-muted-foreground">
          {summary.orders ? `${(summary.units / summary.orders).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por pedido` : "—"}
        </span>
        {summary.cancelled.orders > 0 && (
          <span className="mt-auto pt-2 text-xs text-muted-foreground">
            {summary.cancelled.orders === 1 ? "1 pedido cancelado" : `${summary.cancelled.orders} pedidos cancelados`} (
            {formatCurrencyBRL(summary.cancelled.value)}), fora das contas
          </span>
        )}
      </StatTile>
    </div>
  );
}
