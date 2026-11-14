"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { format, parseISO } from "date-fns";
import { ChevronDown, PackageCheck } from "lucide-react";
import type { Order } from "@react-menu/contracts";
import { OrderLines } from "./order-lines";

/** How many of the latest hand-overs attendants see. */
export const RECENT_DELIVERIES = 3;

/** The latest of today's delivered orders, newest first. */
export function recentDeliveries(delivered: Order[]) {
  return [...delivered]
    .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))
    .slice(0, RECENT_DELIVERIES);
}

/**
 * Attendants' "Últimos entregues", to check what went out (items and
 * drinks). No amounts: the day's sales stay with the managers.
 */
export function RecentDeliveries({ orders }: { orders: Order[] }) {
  return (
    <Collapsible.Root className="group/recent overflow-hidden rounded-2xl border bg-card">
      <Collapsible.Trigger className="flex w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <PackageCheck className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Últimos entregues</span>
          <span className="block truncate text-xs text-muted-foreground">
            {orders.length === 1 ? "O último pedido entregue" : `Os ${orders.length} últimos pedidos entregues`}, para conferir
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[open]/recent:rotate-180" />
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        <ul className="flex flex-col divide-y border-t">
          {orders.map((order) => (
            <li key={order.id} aria-label={`Pedido ${order.number} de ${order.customerName}`} className="flex gap-3 p-4">
              <span className="flex h-8 min-w-12 shrink-0 items-center justify-center rounded-lg bg-muted px-2 text-sm font-bold tabular-nums">
                #{order.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="truncate font-semibold">{order.customerName}</span>
                  {order.completedAt && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Entregue às {format(parseISO(order.completedAt), "HH:mm")}
                    </span>
                  )}
                </p>
                <OrderLines items={order.items} className="mt-1 gap-0.5" />
                {order.notes && <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs">{order.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
