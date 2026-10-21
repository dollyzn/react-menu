"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, Link2, RefreshCw, RotateCcw, Share2, ShoppingBag, Smartphone, Unlink } from "lucide-react";
import { toast } from "sonner";
import type { PublicOrderSummary } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { linkStore, unlinkStore } from "@/redux/slices/customer";
import { useGetOrderHistoryQuery } from "@/redux/features/public/publicApi";
import { copyToClipboard } from "@/utils/copy-to-clipboard";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";
import { CustomerShell } from "./customer-shell";
import { ORDER_STATUS, PROGRESS, isActiveOrder, linkUrl, useReorder } from "../_lib/customer-orders";

/** "Meus pedidos": live orders first, then history, plus the device link. */
export function OrderHistory() {
  const rehydrated = useRehydrated();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recent = useAppSelector((state) => state.customer.recentOrders);
  const tokenMap = useAppSelector((state) => state.customer.tokens);

  const tokens = recent.map((order) => order.publicToken);
  const links = Object.entries(tokenMap ?? {}).map(([storeSlug, token]) => ({ storeSlug, token }));
  const nothingToLoad = tokens.length === 0 && links.length === 0;

  const { data, isLoading, isFetching, refetch } = useGetOrderHistoryQuery(
    { tokens, links },
    { skip: !rehydrated || nothingToLoad, refetchOnFocus: true }
  );
  const orders = data?.orders ?? [];
  const active = orders.filter((order) => isActiveOrder(order.status));
  const past = orders.filter((order) => !isActiveOrder(order.status));

  // Live statuses while something is on its way (the tracking page has realtime).
  useEffect(() => {
    if (active.length === 0) return;
    const timer = setInterval(() => void refetch(), 15_000);
    return () => clearInterval(timer);
  }, [active.length, refetch]);

  // ?vincular=<store>.<token>: link opened from another device.
  useEffect(() => {
    if (!rehydrated) return;
    const raw = searchParams.get("vincular");
    if (!raw) return;
    const dot = raw.indexOf(".");
    if (dot > 0) {
      dispatch(linkStore({ storeSlug: raw.slice(0, dot), token: raw.slice(dot + 1) }));
      toast.success("Pronto! Este aparelho agora mostra os seus pedidos.");
    }
    router.replace("/pedidos");
  }, [dispatch, rehydrated, router, searchParams]);

  // Links revoked or from another database: forget them quietly.
  useEffect(() => {
    if (!data?.staleLinks.length) return;
    data.staleLinks.forEach((slug) => dispatch(unlinkStore(slug)));
    toast.info("O vínculo com seus pedidos de outro aparelho expirou neste celular.");
  }, [data?.staleLinks, dispatch]);

  return (
    <CustomerShell
      actions={
        // Depends on this device's storage: never part of the server HTML.
        rehydrated &&
        !nothingToLoad && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Atualizar pedidos"
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn(isFetching && "animate-spin")} />
          </Button>
        )
      }
    >
      <h1 className="text-2xl font-bold">Meus pedidos</h1>

      {!rehydrated || (isLoading && !nothingToLoad) ? (
        <div className="mt-6 space-y-3" aria-busy>
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyHistory />
      ) : (
        <>
          {active.length > 0 && (
            <section className="mt-6 space-y-3" aria-labelledby="active-orders">
              <h2 id="active-orders" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Em andamento
              </h2>
              <AnimatePresence initial={false}>
                {active.map((order) => (
                  <ActiveOrderCard key={order.publicToken} order={order} />
                ))}
              </AnimatePresence>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-8 space-y-2" aria-labelledby="past-orders">
              <h2 id="past-orders" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Anteriores
              </h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {past.map((order) => (
                  <PastOrderRow key={order.publicToken} order={order} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {rehydrated && <DeviceLink customers={data?.customers ?? []} />}
    </CustomerShell>
  );
}

const itemsSummary = (order: PublicOrderSummary) =>
  order.items.map((item) => `${item.quantity}× ${item.name}`).join(", ");

function ActiveOrderCard({ order }: { order: PublicOrderSummary }) {
  const status = ORDER_STATUS[order.status];
  const step = PROGRESS.indexOf(order.status);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      aria-label={`Pedido ${order.number}: ${status.label}`}
    >
      <Link
        href={`/pedido/${order.publicToken}`}
        className={cn(
          "block rounded-2xl border bg-card p-4 shadow-sm transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
          order.status === "ready" && "border-emerald-500/50 bg-emerald-500/5"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{order.store.name}</p>
            <p className="text-3xl font-black tabular-nums">#{order.number}</p>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", status.tone)}>
            <status.icon className="size-3.5" /> {status.label}
          </span>
        </div>
        {step >= 0 && (
          <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden>
            {PROGRESS.map((s, index) => (
              <span
                key={s}
                className={cn(
                  "h-1.5 rounded-full",
                  index < step ? "bg-primary" : index === step ? "animate-pulse bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        )}
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{itemsSummary(order)}</p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatDistanceToNow(parseISO(order.createdAt), { addSuffix: true, locale: ptBR })}
          </span>
          <span className="flex items-center gap-1 font-medium text-primary">
            Acompanhar <ChevronRight className="size-4" />
          </span>
        </div>
      </Link>
    </motion.article>
  );
}

function PastOrderRow({ order }: { order: PublicOrderSummary }) {
  const reorder = useReorder();
  const status = ORDER_STATUS[order.status];

  return (
    <li className="flex items-center gap-3 p-3">
      <Link href={`/pedido/${order.publicToken}`} className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <p className="flex items-center gap-2 text-sm">
          <span className="font-semibold tabular-nums">#{order.number}</span>
          <span className="text-muted-foreground">
            {format(parseISO(order.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.tone)}>{status.label}</span>
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{itemsSummary(order)}</p>
        <p className="text-sm font-medium tabular-nums">{formatCurrencyBRL(order.total)}</p>
      </Link>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 rounded-full"
        onClick={() => reorder(order.publicToken, order.store.slug)}
        aria-label={`Pedir de novo o pedido ${order.number}`}
      >
        <RotateCcw /> Pedir de novo
      </Button>
    </li>
  );
}

function EmptyHistory() {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShoppingBag className="size-8" />
      </span>
      <p className="font-semibold">Nenhum pedido por aqui ainda</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Os pedidos que você fizer neste aparelho aparecem aqui, com o andamento ao vivo.
      </p>
      <Button className="mt-2 rounded-full" render={<Link href="/" />} nativeButton={false}>
        Ver cardápio
      </Button>
    </div>
  );
}

/** Share the history with another device, or stop sharing on this one. */
function DeviceLink({ customers }: { customers: { name: string; phone: string; storeSlug: string }[] }) {
  const dispatch = useAppDispatch();
  const tokenMap = useAppSelector((state) => state.customer.tokens) ?? {};
  const linked = customers.filter((customer) => tokenMap[customer.storeSlug]);

  const share = async (storeSlug: string) => {
    const url = linkUrl(storeSlug, tokenMap[storeSlug]);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Meus pedidos", text: "Abra no outro celular para ver seus pedidos:", url });
        return;
      } catch {
        // Cancelled: fall back to copying.
      }
    }
    copyToClipboard(url, { toastSuccessMessage: "Link copiado! Abra no outro aparelho." });
  };

  return (
    <section className="mt-10 rounded-2xl border border-dashed p-4" aria-labelledby="device-link">
      <h2 id="device-link" className="flex items-center gap-2 font-semibold">
        <Smartphone className="size-4 text-primary" /> Seus pedidos em outro aparelho
      </h2>
      {linked.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Para ver aqui também os pedidos feitos em outro celular, abra neste aparelho o link “Usar em outro
          aparelho” do celular em que você fez seu primeiro pedido. Por segurança, só o seu telefone não basta.
        </p>
      ) : (
        linked.map((customer) => (
          <div key={customer.storeSlug} className="mt-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Vinculado a <span className="font-medium text-foreground">{customer.name}</span> · {customer.phone}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="rounded-full" onClick={() => void share(customer.storeSlug)}>
                <Share2 /> Usar em outro aparelho
              </Button>
              <AlertDialogDestructive
                title="Desvincular este aparelho?"
                description="Os pedidos feitos em outros aparelhos deixam de aparecer aqui. Você pode vincular de novo pelo link."
                confirmLabel="Desvincular"
                onConfirm={() => dispatch(unlinkStore(customer.storeSlug))}
              >
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground">
                  <Unlink /> Desvincular
                </Button>
              </AlertDialogDestructive>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Link2 className="mt-0.5 size-3.5 shrink-0" /> Quem tiver esse link vê seus pedidos. Envie só para você.
            </p>
          </div>
        ))
      )}
    </section>
  );
}
