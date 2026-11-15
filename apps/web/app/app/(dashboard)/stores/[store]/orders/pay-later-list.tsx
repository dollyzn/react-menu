"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Banknote, HandCoins, MessageCircle, Phone } from "lucide-react";
import type { PayLaterOrder } from "@react-menu/contracts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPayLaterOrdersQuery } from "@/redux/features/order/orderApi";
import { useLastValue } from "@/hooks/use-last-value";
import { lineName } from "@/lib/order-line";
import { formatCurrencyBRL, formatPhoneBR } from "@/utils/string";
import { STATUS } from "./order-labels";
import { ReceivePayment } from "./receive-payment";

type Customer = { key: string; name: string; phone: string | null; orders: PayLaterOrder[]; due: number };

/** The open "Pagar depois" grouped by who owes, the oldest debt first. */
export function groupByCustomer(orders: PayLaterOrder[]): Customer[] {
  const byKey = new Map<string, Customer>();
  for (const order of orders) {
    const key = order.customerPhone ?? `name:${order.customerName}`;
    const customer = byKey.get(key) ?? { key, name: order.customerName, phone: order.customerPhone, orders: [], due: 0 };
    customer.orders.push(order);
    customer.due += order.amountDue;
    // The latest name they gave (the counter may have corrected it).
    customer.name = order.customerName;
    byKey.set(key, customer);
  }
  return [...byKey.values()];
}

/**
 * Managers: orders sent as "pagar depois" (fiado) and not paid yet, any day,
 * by customer with what each owes. "Receber" records the payment (cash, Pix,
 * cards or the card machine) and the order leaves the list.
 */
export function PayLaterList({ storeId }: { storeId: string }) {
  const { data: orders = [], isLoading, isError, refetch } = useGetPayLaterOrdersQuery(storeId, { pollingInterval: 60_000 });
  const customers = useMemo(() => groupByCustomer(orders), [orders]);
  const total = customers.reduce((sum, customer) => sum + customer.due, 0);
  const [receiving, setReceiving] = useState<PayLaterOrder | null>(null);
  const shown = useLastValue(receiving);

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;

  // Never "Ninguém devendo" when the list couldn't be read.
  if (isError && orders.length === 0) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar os pedidos para pagar depois.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        <HandCoins className="size-10 opacity-40" />
        <p className="text-sm">Ninguém devendo. Pedidos enviados como “Pagar depois” aparecem aqui até serem pagos.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{formatCurrencyBRL(total)}</span> em aberto ·{" "}
        {orders.length} {orders.length === 1 ? "pedido" : "pedidos"} de {customers.length}{" "}
        {customers.length === 1 ? "cliente" : "clientes"}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {customers.map((customer) => {
          const phone = customer.phone?.replace(/^55/, "");
          return (
            <section
              key={customer.key}
              aria-label={`${customer.name}: ${formatCurrencyBRL(customer.due)} para pagar`}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{customer.name}</p>
                  {phone && <p className="text-sm text-muted-foreground tabular-nums">{formatPhoneBR(phone)}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-black text-primary tabular-nums">{formatCurrencyBRL(customer.due)}</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.orders.length} {customer.orders.length === 1 ? "pedido" : "pedidos"}
                  </p>
                </div>
              </header>

              {phone && (
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:+55${phone}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <Phone /> Ligar
                  </a>
                  <a
                    href={`https://wa.me/55${phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <MessageCircle /> WhatsApp
                  </a>
                </div>
              )}

              <ul className="flex flex-col divide-y rounded-xl border">
                {customer.orders.map((order) => (
                  <li key={order.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        #{order.number} · {format(parseISO(order.createdAt), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.items.map((line) => `${line.quantity}× ${lineName(line)}`).join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.status === "completed" ? "Entregue" : STATUS[order.status].label}
                        {order.payLaterBy?.name ? ` · por ${order.payLaterBy.name}` : ""}
                        {order.amountPaid > 0 ? ` · já pagou ${formatCurrencyBRL(order.amountPaid)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrencyBRL(order.amountDue)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Receber o pedido #${order.number}`}
                        onClick={() => setReceiving(order)}
                      >
                        <Banknote /> Receber
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {shown && (
        <ReceivePayment order={shown} storeId={storeId} open={receiving !== null} onClose={() => setReceiving(null)} />
      )}
    </div>
  );
}
