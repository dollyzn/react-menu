"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { ClipboardList, Plus } from "lucide-react";
import type { Order, OrderStatus } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetOrdersQuery } from "@/redux/features/order/orderApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { useStoreRole } from "@/hooks/use-store-role";
import { useNow } from "@/hooks/use-now";
import { OrderCard } from "./order-card";
import { cn } from "@/lib/utils";

const COLUMNS: { status: OrderStatus; title: string; empty: string }[] = [
  { status: "received", title: "Na fila", empty: "Nenhum pedido esperando." },
  { status: "preparing", title: "Em preparo", empty: "A cozinha está livre." },
  { status: "ready", title: "Prontos para retirada", empty: "Nada para entregar." },
];

export default function OrdersPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const { data: orders = [], isLoading } = useGetOrdersQuery({ storeId }, { pollingInterval: 30_000 });
  const { data: store } = useGetStoreByIdQuery(storeId);
  const role = useStoreRole(storeId);
  const now = useNow();
  const [mobileColumn, setMobileColumn] = useState<OrderStatus>("received");

  const byStatus = useMemo(() => {
    const groups = new Map<OrderStatus, Order[]>();
    for (const order of orders) groups.set(order.status, [...(groups.get(order.status) ?? []), order]);
    return groups;
  }, [orders]);

  const awaitingPayment = byStatus.get("pending_payment") ?? [];
  const finished = [...(byStatus.get("completed") ?? []), ...(byStatus.get("cancelled") ?? [])];
  const canOperate = role === "manager" || role === "attendant";

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Pedidos de hoje</h1>
          <p className="text-sm text-muted-foreground">Atualiza sozinho. Entregue no balcão os pedidos prontos.</p>
        </div>
        {canOperate && (
          <Button render={<Link href={`/app/stores/${storeId}/pos`} />} nativeButton={false}>
            <Plus /> Novo pedido
          </Button>
        )}
      </header>

      {awaitingPayment.length > 0 && (
        <p className="rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {awaitingPayment.length} pedido(s) online aguardando a confirmação do pagamento.
        </p>
      )}

      <Tabs value={mobileColumn} onValueChange={(v) => setMobileColumn(v as OrderStatus)} className="md:hidden">
        <TabsList className="grid w-full grid-cols-3">
          {COLUMNS.map((column) => (
            <TabsTrigger key={column.status} value={column.status}>
              {column.title.split(" ")[0]} ({byStatus.get(column.status)?.length ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const list = byStatus.get(column.status) ?? [];
          return (
            <section
              key={column.status}
              aria-label={column.title}
              className={cn("flex flex-col gap-3", mobileColumn !== column.status && "max-md:hidden")}
            >
              <h2 className="flex items-center justify-between text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                {column.title}
                <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">{list.length}</span>
              </h2>
              {isLoading ? (
                <Skeleton className="h-40 rounded-2xl" />
              ) : list.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{column.empty}</p>
              ) : (
                <AnimatePresence initial={false}>
                  {list.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      storeId={storeId}
                      now={now}
                      etaMinutes={store?.pickupEtaMinutes ?? 20}
                      canOperate={canOperate}
                    />
                  ))}
                </AnimatePresence>
              )}
            </section>
          );
        })}
      </div>

      {finished.length > 0 && (
        <details className="group rounded-2xl border p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <ClipboardList className="size-4" /> Concluídos e cancelados hoje ({finished.length})
          </summary>
          <ul className="mt-3 divide-y text-sm">
            {finished.map((order) => (
              <li key={order.id} className="flex justify-between py-2">
                <span>
                  <span className="font-semibold tabular-nums">#{order.number}</span> {order.customerName}
                </span>
                <span className={cn("tabular-nums", order.status === "cancelled" && "text-muted-foreground line-through")}>
                  {order.status === "cancelled" ? "Cancelado" : "Entregue"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
