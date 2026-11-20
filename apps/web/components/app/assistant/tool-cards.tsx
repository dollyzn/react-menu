"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import type {
  AssistantOptionGroups,
  AssistantFoundOrders,
  AssistantOrderDetails,
  AssistantStoreStatus,
  AssistantTools,
  AssistantItemSales,
  AssistantMenuItems,
  AssistantOrdersNow,
  AssistantPayLater,
  AssistantSalesSummary,
  AssistantStockForecast,
  AssistantStockStatus,
  AssistantToolName,
} from "@react-menu/contracts";
import { Delta } from "@/components/app/stat-tile";
import { RankedList } from "@/components/app/ranked-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNEL, PAYMENT, STATUS } from "@/app/app/(dashboard)/stores/[store]/orders/order-labels";
import { groupRule } from "@/lib/group-rule";
import { formatDay, formatWeekday } from "@/lib/report-period";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/utils/string";
import { formatQuantity } from "@/utils/units";

/** A tool's result in the reply: one bordered card, title and a line under it. */
function ResultCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground", className)}>
      <header className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

function Figure({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted/50 px-2.5 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-base font-semibold tabular-nums">{value}</span>
      {children}
    </div>
  );
}

const period = (from: string, to: string) => (from === to ? formatWeekday(from) : `${formatDay(from)} a ${formatDay(to)}`);

const chartConfig = {
  revenue: { label: "Faturamento", color: "var(--primary)" },
  units: { label: "Unidades", color: "var(--primary)" },
  orders: { label: "Pedidos", color: "var(--primary)" },
} satisfies ChartConfig;

/** One series in `--primary`, value in the tooltip (no legend for one series). */
function MiniBars<T extends object>({
  data,
  x,
  y,
  format,
  label,
}: {
  data: T[];
  x: string;
  y: keyof typeof chartConfig;
  format: (row: T) => { title: string; value: string };
  label: string;
}) {
  return (
    <figure className="flex flex-col gap-1">
      <ChartContainer config={chartConfig} className="aspect-auto h-32 w-full">
        <BarChart data={data} margin={{ left: 0, right: 0, top: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} tickLine={false} axisLine={false} tickMargin={6} minTickGap={16} fontSize={11} />
          <ChartTooltip
            cursor={{ fillOpacity: 0.5 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as T | undefined) : undefined;
              if (!row) return null;
              const { title, value } = format(row);
              return (
                <div className="grid gap-0.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <span className="text-muted-foreground">{title}</span>
                  <span className="text-sm font-semibold tabular-nums">{value}</span>
                </div>
              );
            }}
          />
          <Bar dataKey={y} fill={`var(--color-${y})`} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

export function SalesCard({ data }: { data: AssistantSalesSummary }) {
  const { summary } = data;
  const daily = data.daily && data.daily.length > 1 && data.daily.some((day) => day.revenue > 0) ? data.daily.map((day) => ({ ...day, label: formatDay(day.date) })) : null;
  const hourly = data.hourly.map((row) => ({ ...row, label: `${row.hour}h` }));
  return (
    <ResultCard title="Vendas" description={`${period(data.period.from, data.period.to)} · comparado a ${period(data.previousPeriod.from, data.previousPeriod.to)}`}>
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Faturamento" value={formatCurrencyBRL(summary.revenue)}>
          <Delta current={summary.revenue} previous={summary.previous.revenue} against="" shortAgainst="" />
        </Figure>
        <Figure label="Pedidos" value={String(summary.orders)}>
          <Delta current={summary.orders} previous={summary.previous.orders} against="" shortAgainst="" />
        </Figure>
        <Figure label="Ticket médio" value={formatCurrencyBRL(summary.averageTicket)} />
      </div>
      {daily ? (
        <MiniBars
          data={daily}
          x="label"
          y="revenue"
          label="Faturamento por dia"
          format={(day) => ({ title: formatWeekday(day.date), value: formatCurrencyBRL(day.revenue) })}
        />
      ) : hourly.length > 1 ? (
        <MiniBars
          data={hourly}
          x="label"
          y="orders"
          label="Pedidos por hora"
          format={(row) => ({ title: `${row.hour}h`, value: `${row.orders} pedidos` })}
        />
      ) : null}
      <RankedList
        label="Mais vendidos"
        limit={5}
        empty="Nenhuma venda no período."
        rows={data.topItems.map((item) => ({
          key: item.name,
          label: item.name,
          amount: item.quantity,
          value: `${item.quantity} un`,
          detail: formatCurrencyBRL(item.revenue),
        }))}
      />
    </ResultCard>
  );
}

export function ItemSalesCard({ data }: { data: AssistantItemSales }) {
  const daily = data.period.daily.length > 1 && data.period.units > 0 ? data.period.daily.map((day) => ({ ...day, label: formatDay(day.date) })) : null;
  return (
    <ResultCard
      title={data.matches.length === 1 ? data.matches[0] : `Itens com “${data.query}”`}
      description={period(data.period.from, data.period.to)}
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure label="Unidades" value={String(data.period.units)}>
          {data.comparison && (
            <Delta current={data.period.units} previous={data.comparison.units} against="" shortAgainst="" />
          )}
        </Figure>
        <Figure label="Faturamento" value={formatCurrencyBRL(data.period.revenue)}>
          {data.comparison && (
            <Delta current={data.period.revenue} previous={data.comparison.revenue} against="" shortAgainst="" />
          )}
        </Figure>
      </div>
      {data.comparison && (
        <p className="text-xs text-muted-foreground">
          Antes ({period(data.comparison.from, data.comparison.to)}): {data.comparison.units} un ·{" "}
          {formatCurrencyBRL(data.comparison.revenue)}
        </p>
      )}
      {daily && (
        <MiniBars
          data={daily}
          x="label"
          y="units"
          label="Unidades por dia"
          format={(day) => ({ title: formatWeekday(day.date), value: `${day.units} un` })}
        />
      )}
      {data.matches.length > 1 && <p className="text-xs text-muted-foreground">Inclui: {data.matches.join(", ")}</p>}
    </ResultCard>
  );
}

const STOCK: Record<AssistantStockStatus, { label: string; variant: "destructive" | "secondary" | "outline"; className?: string }> = {
  out: { label: "Acabou", variant: "destructive" },
  short: { label: "Não dá", variant: "destructive" },
  low: { label: "Abaixo do mínimo", variant: "secondary", className: "bg-warning/10 text-warning" },
  ok: { label: "Ok", variant: "outline", className: "text-success" },
};

export function StockCard({ data }: { data: AssistantStockForecast }) {
  const [all, setAll] = useState(false);
  if (!data.enabled) {
    return (
      <ResultCard title="Estoque" description="A loja não controla estoque: ligue em Loja › Funcionamento.">
        <span className="sr-only">Sem dados</span>
      </ResultCard>
    );
  }
  const attention = data.ingredients.filter((row) => row.status !== "ok");
  const rows = all || attention.length === 0 ? data.ingredients : attention;
  return (
    <ResultCard
      title={`Estoque para ${data.days === 1 ? "1 dia" : `${data.days} dias`}`}
      description={`Consumo como em ${period(data.base.from, data.base.to)} · ${attention.length} de ${data.ingredients.length} insumos pedem atenção`}
    >
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Insumo</TableHead>
            <TableHead className="text-right">Tem</TableHead>
            <TableHead className="text-right">Precisa</TableHead>
            <TableHead>Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-32 truncate font-medium">
                {row.icon && <span className="mr-1 font-emoji">{row.icon}</span>}
                {row.name}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatQuantity(row.stock, row.unit)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatQuantity(row.need, row.unit)}</TableCell>
              <TableCell>
                <Badge variant={STOCK[row.status].variant} className={STOCK[row.status].className}>
                  {STOCK[row.status].label}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {attention.length > 0 && attention.length < data.ingredients.length && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAll((value) => !value)}>
          {all ? "Só os que pedem atenção" : `Ver todos os ${data.ingredients.length}`}
        </Button>
      )}
    </ResultCard>
  );
}

export function OrdersNowCard({ data }: { data: AssistantOrdersNow }) {
  const late = data.orders.filter((order) => order.late).length;
  return (
    <ResultCard
      title="Pedidos em andamento"
      description={`${data.orders.length} abertos · ${late} passando de ${data.etaMinutes} min`}
    >
      {data.orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido aberto agora.</p>
      ) : (
        <ItemGroup className="gap-1">
          {data.orders.slice(0, 8).map((order) => (
            <Item key={order.id} variant="muted" size="xs">
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full">
                  <span className="tabular-nums text-muted-foreground">#{order.number}</span>
                  <span className="truncate">{order.customerName}</span>
                </ItemTitle>
                <ItemDescription className="line-clamp-1">{order.items}</ItemDescription>
              </ItemContent>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={order.late ? "destructive" : "outline"} className="tabular-nums">
                  {order.minutes} min
                </Badge>
                <span className={cn("rounded-full px-1.5 text-[0.7rem]", STATUS[order.status].tone)}>
                  {STATUS[order.status].label}
                </span>
              </div>
            </Item>
          ))}
        </ItemGroup>
      )}
    </ResultCard>
  );
}

export function FoundOrdersCard({ data }: { data: AssistantFoundOrders }) {
  return (
    <ResultCard title="Pedidos encontrados" description={data.total > data.orders.length ? `${data.orders.length} de ${data.total}` : `${data.total} pedidos`}>
      {data.orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido com esses filtros.</p>
      ) : (
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="tabular-nums">
                  #{order.number}
                  <span className="block text-muted-foreground">{formatDay(order.date)}</span>
                </TableCell>
                <TableCell className="max-w-28 truncate">{order.customerName}</TableCell>
                <TableCell>
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[0.7rem]", STATUS[order.status].tone)}>
                    {STATUS[order.status].label}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrencyBRL(order.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ResultCard>
  );
}

export function PayLaterCard({ data }: { data: AssistantPayLater }) {
  return (
    <ResultCard title="Fiado em aberto" description={`${data.count} pedidos · ${formatCurrencyBRL(data.total)} a receber`}>
      <RankedList
        label="Quem deve mais"
        limit={6}
        empty="Ninguém está devendo."
        rows={data.debtors.map((debtor) => ({
          key: `${debtor.name}-${debtor.phone}`,
          label: debtor.phone ? `${debtor.name} · ${debtor.phone}` : debtor.name,
          amount: debtor.due,
          value: formatCurrencyBRL(debtor.due),
          detail: debtor.orders === 1 ? "1 pedido" : `${debtor.orders} pedidos`,
        }))}
      />
    </ResultCard>
  );
}

export function MenuItemsCard({ data }: { data: AssistantMenuItems }) {
  const [all, setAll] = useState(false);
  const rows = all ? data.items : data.items.slice(0, 8);
  const paused = data.items.filter((item) => !item.isAvailable).length;
  return (
    <ResultCard title="Cardápio" description={`${data.items.length} itens · ${paused} pausados`}>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead>Venda</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="max-w-40">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="block truncate text-muted-foreground">{item.category}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrencyBRL(item.price)}</TableCell>
              <TableCell>
                {item.isAvailable ? (
                  <Badge variant="outline" className="text-success">
                    {item.stockLeft !== null ? `Restam ${item.stockLeft}` : "À venda"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pausado</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.items.length > 8 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAll((value) => !value)}>
          {all ? "Mostrar menos" : `Ver todos os ${data.items.length}`}
        </Button>
      )}
    </ResultCard>
  );
}

/** The store's choice groups: rule, options and who uses each. */
export function OptionGroupsCard({ data }: { data: AssistantOptionGroups }) {
  const [all, setAll] = useState(false);
  const rows = all ? data.groups : data.groups.slice(0, 6);
  return (
    <ResultCard title="Grupos de escolha" description={`${data.groups.length} ${data.groups.length === 1 ? "grupo" : "grupos"}`}>
      <ItemGroup className="gap-2">
        {rows.map((group) => (
          <Item key={group.id} variant="outline" size="sm" className="items-start">
            <ItemContent className="min-w-0">
              <ItemTitle className="flex flex-wrap items-center gap-x-2">
                {group.name}
                <Badge variant={group.minChoices > 0 ? "secondary" : "outline"}>{groupRule(group)}</Badge>
              </ItemTitle>
              <ItemDescription className="line-clamp-none">
                {group.options.map((option) => option.name).join(", ")}
              </ItemDescription>
              <span className="text-xs text-muted-foreground">
                {group.items.count === 0
                  ? "Nenhum item usa"
                  : `Em ${group.items.count} ${group.items.count === 1 ? "item" : "itens"}: ${group.items.names.slice(0, 4).join(", ")}${group.items.count > 4 ? "…" : ""}`}
              </span>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {data.groups.length > 6 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setAll((value) => !value)}>
          {all ? "Mostrar menos" : `Ver todos os ${data.groups.length}`}
        </Button>
      )}
    </ResultCard>
  );
}

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;

const STORE_STATUS: Record<AssistantStoreStatus["status"], string> = {
  open: "Aberta",
  closed: "Fechada",
  maintenance: "Em manutenção",
};

export function StoreStatusCard({ data }: { data: AssistantStoreStatus }) {
  const when = data.isOpen ? (data.closesAt ? `até ${time(data.closesAt)}` : null) : data.opensAt ? `abre às ${time(data.opensAt)}` : null;
  return (
    <ResultCard title="Loja" description={data.scheduleEnabled ? "Segue o horário de funcionamento" : "Aberta e fechada à mão"}>
      <div className="grid grid-cols-2 gap-2">
        <Figure label="Pedidos online" value={data.isOpen ? "Recebendo" : "Fechados"}>
          {when && <span className="text-xs text-muted-foreground">{when}</span>}
        </Figure>
        <Figure label="Tempo de retirada" value={`${data.pickupEtaMinutes} min`}>
          <span className="text-xs text-muted-foreground">Status: {STORE_STATUS[data.status]}</span>
        </Figure>
      </div>
    </ResultCard>
  );
}

export function TodayCard({ data }: { data: AssistantTools["today_overview"]["output"] }) {
  const queue = data.queue.received + data.queue.preparing + data.queue.ready;
  return (
    <ResultCard title="Hoje até agora" description="Comparado ao mesmo dia da semana passada até este horário">
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Faturamento" value={formatCurrencyBRL(data.sales.revenue)}>
          <Delta current={data.sales.revenue} previous={data.sales.lastWeek.revenue} against="" shortAgainst="" />
        </Figure>
        <Figure label="Pedidos" value={String(data.sales.orders)}>
          <Delta current={data.sales.orders} previous={data.sales.lastWeek.orders} against="" shortAgainst="" />
        </Figure>
        <Figure label="Na fila agora" value={String(queue)}>
          {data.kitchen.averageMinutes !== null && (
            <span className="text-xs text-muted-foreground">cozinha: {data.kitchen.averageMinutes} min</span>
          )}
        </Figure>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={data.store.isOpen ? "outline" : "secondary"} className={data.store.isOpen ? "text-success" : undefined}>
          {data.store.isOpen ? "Loja aberta" : "Loja fechada"}
        </Badge>
        {data.lowStock.length > 0 && (
          <Badge variant="secondary" className="bg-warning/10 text-warning">
            {data.lowStock.length} insumos abaixo do mínimo
          </Badge>
        )}
        {data.menu.paused > 0 && <Badge variant="secondary">{data.menu.paused} itens pausados</Badge>}
        {data.menu.soldOut > 0 && <Badge variant="destructive">{data.menu.soldOut} esgotados</Badge>}
      </div>
      {data.topItems.length > 0 && (
        <RankedList
          label="Mais vendidos hoje"
          limit={3}
          empty=""
          rows={data.topItems.map((item) => ({ key: item.name, label: item.name, amount: item.quantity, value: `${item.quantity} un` }))}
        />
      )}
    </ResultCard>
  );
}

export function OrderDetailsCard({ data }: { data: AssistantOrderDetails }) {
  const Channel = CHANNEL[data.channel].icon;
  return (
    <ResultCard
      title={`Pedido #${data.number} · ${data.customerName}`}
      description={`${formatDay(data.date)} às ${time(data.createdAt)} · ${CHANNEL[data.channel].label}${data.customerPhone ? ` · ${data.customerPhone}` : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS[data.status].tone)}>{STATUS[data.status].label}</span>
        <Badge variant="outline">
          <Channel />
          {PAYMENT[data.paymentMethod]}
        </Badge>
        {data.payLater && <Badge variant="secondary">Pagar depois</Badge>}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {data.lines.map((line, index) => (
          <li key={index} className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="tabular-nums">{line.quantity}× </span>
              {line.name}
              {line.addons.length > 0 && <span className="block text-xs text-muted-foreground">{line.addons.join(", ")}</span>}
              {line.notes && <span className="block text-xs text-muted-foreground italic">“{line.notes}”</span>}
            </span>
            <span className="shrink-0 tabular-nums">{formatCurrencyBRL(line.total)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">
          {data.amountDue > 0 ? `Falta receber ${formatCurrencyBRL(data.amountDue)}` : "Pago"}
        </span>
        <span className="font-semibold tabular-nums">{formatCurrencyBRL(data.total)}</span>
      </div>
    </ResultCard>
  );
}

/** The card of a read tool's output (writes are shown by their approval card). */
export function ToolResult({ name, output }: { name: AssistantToolName; output: unknown }) {
  switch (name) {
    case "sales_summary":
      return <SalesCard data={output as AssistantSalesSummary} />;
    case "item_sales":
      return <ItemSalesCard data={output as AssistantItemSales} />;
    case "stock_forecast":
      return <StockCard data={output as AssistantStockForecast} />;
    case "orders_now":
      return <OrdersNowCard data={output as AssistantOrdersNow} />;
    case "find_orders":
      return <FoundOrdersCard data={output as AssistantFoundOrders} />;
    case "pay_later_open":
      return <PayLaterCard data={output as AssistantPayLater} />;
    case "menu_items":
      return <MenuItemsCard data={output as AssistantMenuItems} />;
    case "store_status":
      return <StoreStatusCard data={output as AssistantStoreStatus} />;
    case "today_overview":
      return <TodayCard data={output as AssistantTools["today_overview"]["output"]} />;
    case "order_details":
      return <OrderDetailsCard data={output as AssistantOrderDetails} />;
    case "option_groups":
      return <OptionGroupsCard data={output as AssistantOptionGroups} />;
    default:
      return null;
  }
}
