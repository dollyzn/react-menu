"use client";

import { Collapsible } from "@base-ui/react/collapsible";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, ClipboardCheck } from "lucide-react";
import type { Order } from "@react-menu/contracts";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";

/**
 * The board's "Concluídos e cancelados hoje": closed by default, with a
 * summary of the day in its header; each row opens the order.
 */
export function FinishedOrders({ orders, onOpen }: { orders: Order[]; onOpen: (orderId: string) => void }) {
  const delivered = orders.filter((order) => order.status === "completed");
  const cancelled = orders.length - delivered.length;
  const sold = delivered.reduce((sum, order) => sum + order.total, 0);

  return (
    <Collapsible.Root className="group/finished overflow-hidden rounded-2xl border bg-card">
      <Collapsible.Trigger className="flex w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ClipboardCheck className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            Concluídos e cancelados hoje
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {orders.length}
            </span>
          </span>
          <span className="block truncate text-xs text-muted-foreground tabular-nums">
            {delivered.length} {delivered.length === 1 ? "entregue" : "entregues"}
            {cancelled > 0 && ` · ${cancelled} ${cancelled === 1 ? "cancelado" : "cancelados"}`}
            {sold > 0 && ` · ${formatCurrencyBRL(sold)} vendidos`}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[open]/finished:rotate-180" />
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
        <ul className="flex flex-col gap-1 border-t p-2">
          {orders.map((order) => {
            const isCancelled = order.status === "cancelled";
            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onOpen(order.id)}
                  className="group/row flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex h-8 min-w-12 items-center justify-center rounded-lg bg-muted px-2 text-sm font-bold tabular-nums">
                    #{order.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-medium", isCancelled && "text-muted-foreground line-through")}>
                      {order.customerName}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {format(parseISO(order.createdAt), "HH:mm")} · {formatCurrencyBRL(order.total)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isCancelled ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"
                    )}
                  >
                    {isCancelled ? "Cancelado" : "Entregue"}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100" />
                </button>
              </li>
            );
          })}
        </ul>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
