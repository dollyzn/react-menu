"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Ban,
  Bell,
  BellRing,
  Clock,
  Phone,
  RotateCcw,
  Check,
  ChefHat,
  MapPin,
  PartyPopper,
  ReceiptText,
  ShoppingBag,
} from "lucide-react";
import type { OrderStatus, OrderTrackingEvent } from "@react-menu/contracts";
import { BorderBeam } from "@/components/ui/border-beam";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/api/baseApi";
import { useGetPublicOrderQuery } from "@/redux/features/public/publicApi";
import { getTransmit } from "@/lib/transmit";
import { formatCurrencyBRL } from "@/utils/string";
import { cn } from "@/lib/utils";
import { InstallAppCard } from "@/components/app/pwa/install-app";
import { format, parseISO } from "date-fns";
import { CustomerShell } from "./customer-shell";
import { PaymentPanel } from "./payment-panel";
import { RecentOrdersButton } from "./recent-orders";
import { useReorder } from "../_lib/customer-orders";
import { useReadyAlert } from "../_lib/use-ready-alert";

const STEPS: { status: OrderStatus; label: string; icon: typeof Check }[] = [
  { status: "received", label: "Pedido recebido", icon: ReceiptText },
  { status: "preparing", label: "Em preparo", icon: ChefHat },
  { status: "ready", label: "Pronto para retirada", icon: ShoppingBag },
  { status: "completed", label: "Retirado", icon: PartyPopper },
];

const HEADLINES: Record<OrderStatus, { title: string; subtitle: string }> = {
  pending_payment: { title: "Falta pagar", subtitle: "Assim que o pagamento for aprovado, a cozinha começa." },
  received: { title: "Recebemos seu pedido!", subtitle: "Ele já está na fila da cozinha." },
  preparing: { title: "Mão na massa!", subtitle: "Seus pastéis estão sendo preparados agora." },
  ready: { title: "Pronto! Pode vir buscar", subtitle: "Retire no balcão informando o número do pedido." },
  completed: { title: "Bom apetite!", subtitle: "Pedido retirado. Obrigado pela preferência." },
  cancelled: { title: "Pedido cancelado", subtitle: "Fale com a loja se tiver alguma dúvida." },
};

export function OrderTracking({ token }: { token: string }) {
  const dispatch = useAppDispatch();
  const confettiRef = useRef<ConfettiRef>(null);
  const previousStatus = useRef<OrderStatus | null>(null);
  const { data: order, isLoading, isError } = useGetPublicOrderQuery(token, {
    pollingInterval: 30_000,
    skipPollingIfUnfocused: true,
  });
  const readyAlert = useReadyAlert(order?.status, order?.number);
  const reorder = useReorder();

  // Realtime hint: refetch the order whenever the store updates it.
  useEffect(() => {
    const transmit = getTransmit();
    const subscription = transmit.subscription(`orders/${token}`);
    const stop = subscription.onMessage<OrderTrackingEvent>(() =>
      dispatch(baseApi.util.invalidateTags([{ type: "PublicOrder", id: token }]))
    );
    subscription.create().catch(() => undefined);
    return () => {
      stop();
      if (subscription.handlerCount === 0) void subscription.delete();
    };
  }, [dispatch, token]);

  useEffect(() => {
    if (!order) return;
    if (previousStatus.current && previousStatus.current !== "ready" && order.status === "ready") {
      confettiRef.current?.fire({ particleCount: 140, spread: 80, origin: { y: 0.4 } });
    }
    previousStatus.current = order.status;
  }, [order]);

  if (isError) {
    return (
      <CustomerShell>
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <Ban className="size-10 text-muted-foreground" />
          <p className="font-semibold">Pedido não encontrado</p>
          <Button variant="outline" render={<Link href="/" />} nativeButton={false}>
            Voltar ao cardápio
          </Button>
        </div>
      </CustomerShell>
    );
  }

  if (isLoading || !order) {
    return (
      <CustomerShell>
        <div className="flex flex-col gap-4 py-8" aria-busy>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </CustomerShell>
    );
  }

  const headline = HEADLINES[order.status];
  const at = (status: OrderStatus) => order.timeline.findLast((entry) => entry.status === status)?.at;
  const eta =
    order.status === "received" || order.status === "preparing"
      ? format(
          new Date(parseISO(at("received") ?? order.createdAt).getTime() + order.store.pickupEtaMinutes * 60_000),
          "HH:mm"
        )
      : null;
  const currentStep = STEPS.findIndex((step) => step.status === order.status);
  const isReady = order.status === "ready";

  return (
    <CustomerShell backHref={`/${order.store.slug}`} actions={<RecentOrdersButton />}>
      <Confetti ref={confettiRef} manualstart className="pointer-events-none fixed inset-0 z-50 size-full" />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-3xl border bg-card p-6 text-center shadow-sm",
          isReady && "border-success/40 bg-success/5"
        )}
      >
        {isReady && <BorderBeam size={120} duration={6} colorFrom="#10b981" colorTo="#f59e0b" />}
        <p className="text-sm text-muted-foreground">{order.store.name} · Pedido</p>
        <p className="mt-1 text-6xl font-black tracking-tight tabular-nums">#{order.number}</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={order.status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 flex flex-col gap-1"
            aria-live="polite"
          >
            <h1 className="text-xl font-bold">{headline.title}</h1>
            <p className="text-sm text-muted-foreground">{headline.subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {eta && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
            <Clock className="size-4 text-primary" /> Previsão: pronto por volta das <strong>{eta}</strong>
          </p>
        )}

        {readyAlert.supported && (order.status === "received" || order.status === "preparing") && (
          <div className="mt-4">
            {readyAlert.armed ? (
              <p className="inline-flex items-center gap-1.5 text-sm text-success">
                <BellRing className="size-4" /> Vamos te avisar quando ficar pronto
              </p>
            ) : (
              <Button variant="outline" className="rounded-full" onClick={() => void readyAlert.arm()}>
                <Bell /> Avisar quando ficar pronto
              </Button>
            )}
          </div>
        )}

      </motion.section>

      {order.status === "pending_payment" && <PaymentPanel order={order} />}

      {order.status !== "cancelled" && order.status !== "pending_payment" && (
        <ol className="mt-6" aria-label="Andamento do pedido">
          {STEPS.map((step, index) => {
            const done = index < currentStep || order.status === "completed";
            const active = index === currentStep && order.status !== "completed";
            return (
              <li key={step.status} className="relative flex gap-4 pb-6 last:pb-0">
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-10 left-5 h-[calc(100%-2.5rem)] w-0.5 -translate-x-1/2 rounded-full",
                      done ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
                <motion.span
                  animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={active ? { repeat: Infinity, duration: 1.6 } : undefined}
                  className={cn(
                    "relative flex size-10 shrink-0 items-center justify-center rounded-full border-2",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/10 text-primary",
                    !done && !active && "border-border text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-5" /> : <step.icon className="size-5" />}
                </motion.span>
                <div className="pt-2">
                  <p className={cn("font-medium", !done && !active && "text-muted-foreground")}>{step.label}</p>
                  {(done || active) && at(step.status) ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {active ? "Agora · " : ""}
                      {format(parseISO(at(step.status)!), "HH:mm")}
                    </p>
                  ) : (
                    active && <p className="text-xs text-muted-foreground">Agora</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section className="mt-6 rounded-2xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Resumo</h2>
        <ul className="divide-y">
          {order.items.map((line, index) => (
            <li key={index} className="flex justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {line.quantity}× {line.name}
                </p>
                {line.addons.length > 0 && (
                  <p className="text-xs text-muted-foreground">+ {line.addons.map((a) => a.name).join(", ")}</p>
                )}
                {line.notes && <p className="text-xs text-muted-foreground italic">“{line.notes}”</p>}
              </div>
              <span className="tabular-nums">{formatCurrencyBRL(line.total)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t px-4 py-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrencyBRL(order.total)}</span>
        </div>
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          {order.paymentMethod === "counter"
            ? order.paymentStatus === "paid"
              ? "Pago no balcão"
              : "Pagamento na retirada"
            : order.paymentStatus === "paid"
              ? `Pago online${order.paymentMethod === "pix" ? " com Pix" : order.paymentMethod === "card" ? " com cartão" : ""}`
              : order.paymentStatus === "refunded"
                ? "Pagamento devolvido"
                : "Pagamento online pendente"}
        </p>
      </section>

      {(order.status === "completed" || order.status === "cancelled") && (
        <Button
          size="lg"
          className="mt-6 h-12 w-full rounded-full"
          onClick={() => reorder(order.publicToken, order.store.slug)}
        >
          <RotateCcw /> Pedir de novo
        </Button>
      )}

      {order.store.phone && (
        <Button
          variant="outline"
          className="mt-4 w-full rounded-full"
          render={<a href={`tel:+55${order.store.phone}`} />}
          nativeButton={false}
        >
          <Phone /> Ligar para a loja
        </Button>
      )}

      {order.store.address && (
        <p className="mt-4 flex items-center justify-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" /> Retirada em {order.store.address}
        </p>
      )}

      <InstallAppCard
        context="menu"
        title="Acompanhe seus pedidos pelo app"
        description={`Instale o cardápio da ${order.store.name} para pedir de novo e ver o andamento em um toque.`}
        className="mt-6"
      />
    </CustomerShell>
  );
}
