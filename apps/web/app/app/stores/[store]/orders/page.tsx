"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { ClipboardList, History, Plus, Radio } from "lucide-react";
import type { Order, OrderStatus } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetOrdersQuery } from "@/redux/features/order/orderApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { useStoreRole } from "@/hooks/use-store-role";
import { useNow } from "@/hooks/use-now";
import { OrderCard } from "./order-card";
import { OrderDetailSheet } from "./order-detail-sheet";
import { OrderHistory } from "./order-history";
import { cn } from "@/lib/utils";

/** `tab` is the short label for the phone tabs. */
const COLUMNS: { status: OrderStatus; title: string; tab: string; empty: string }[] = [
  { status: "received", title: "Na fila", tab: "Fila", empty: "Nenhum pedido esperando." },
  { status: "preparing", title: "Em preparo", tab: "Preparo", empty: "A cozinha está livre." },
  { status: "ready", title: "Prontos para retirada", tab: "Prontos", empty: "Nada para entregar." },
];

/** Sets or clears one query param without a navigation (Next keeps useSearchParams in sync). */
function useQueryParam(key: string) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const set = (value: string | null, extra?: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search);
    if (value === null) params.delete(key);
    else params.set(key, value);
    extra?.(params);
    const query = params.toString();
    // null state: Next syncs useSearchParams only for app-made history entries.
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };
  return [searchParams.get(key), set] as const;
}

export default function OrdersPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const [view, setView] = useQueryParam("view");
  const [openOrderId, setOpenOrderId] = useQueryParam("pedido");
  const history = view === "historico";
  const role = useStoreRole(storeId);
  const canOperate = role === "manager" || role === "attendant";

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            {history
              ? "Todos os pedidos da loja: busque, filtre por período e abra qualquer um."
              : "Hoje, ao vivo. Entregue no balcão os pedidos prontos."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={history ? "historico" : "ao-vivo"}
            onValueChange={(value) =>
              // Leaving the history drops its table params (page, filters).
              setView(value === "historico" ? "historico" : null, (params) => {
                if (value !== "historico")
                  for (const key of [...params.keys()])
                    if (key === "page" || key === "size" || key === "sort" || key.startsWith("f.")) params.delete(key);
              })
            }
          >
            <TabsList>
              <TabsTrigger value="ao-vivo">
                <Radio /> Ao vivo
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History /> Histórico
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canOperate && (
            <Button render={<Link href={`/app/stores/${storeId}/pos`} />} nativeButton={false}>
              <Plus /> Novo pedido
            </Button>
          )}
        </div>
      </header>

      {history ? (
        <OrderHistory storeId={storeId} onOpen={setOpenOrderId} />
      ) : (
        <LiveBoard storeId={storeId} canOperate={canOperate} onOpen={setOpenOrderId} />
      )}

      <OrderDetailSheet
        storeId={storeId}
        orderId={openOrderId}
        canOperate={canOperate}
        onClose={() => setOpenOrderId(null)}
      />
    </div>
  );
}

/** Today's board: queue, preparing and ready, updated live. */
function LiveBoard({
  storeId,
  canOperate,
  onOpen,
}: {
  storeId: string;
  canOperate: boolean;
  onOpen: (orderId: string) => void;
}) {
  const { data: orders = [], isLoading } = useGetOrdersQuery({ storeId }, { pollingInterval: 30_000 });
  const { data: store } = useGetStoreByIdQuery(storeId);
  const now = useNow();
  const [mobileColumn, setMobileColumn] = useState<OrderStatus>("received");

  const byStatus = useMemo(() => {
    const groups = new Map<OrderStatus, Order[]>();
    for (const order of orders) groups.set(order.status, [...(groups.get(order.status) ?? []), order]);
    return groups;
  }, [orders]);

  const awaitingPayment = byStatus.get("pending_payment") ?? [];
  const finished = [...(byStatus.get("completed") ?? []), ...(byStatus.get("cancelled") ?? [])];

  return (
    <>
      {awaitingPayment.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {awaitingPayment.length} pedido(s) online aguardando a confirmação do pagamento:
          {awaitingPayment.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => onOpen(order.id)}
              className="rounded-full border bg-card px-2 py-0.5 font-semibold text-foreground tabular-nums hover:bg-muted"
            >
              #{order.number}
            </button>
          ))}
        </div>
      )}

      <Tabs value={mobileColumn} onValueChange={(v) => setMobileColumn(v as OrderStatus)} className="md:hidden">
        <TabsList className="grid w-full grid-cols-3">
          {COLUMNS.map((column) => (
            <TabsTrigger key={column.status} value={column.status}>
              {column.tab} ({byStatus.get(column.status)?.length ?? 0})
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
                      onOpen={onOpen}
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
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onOpen(order.id)}
                  className="flex w-full justify-between rounded-lg px-1 py-2 text-left hover:bg-muted/50"
                >
                  <span>
                    <span className="font-semibold tabular-nums">#{order.number}</span> {order.customerName}
                  </span>
                  <span className={cn("tabular-nums", order.status === "cancelled" && "text-muted-foreground line-through")}>
                    {order.status === "cancelled" ? "Cancelado" : "Entregue"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
