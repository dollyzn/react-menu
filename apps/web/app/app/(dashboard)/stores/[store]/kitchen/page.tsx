"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChefHat,
  Expand,
  Layers,
  MessageSquareWarning,
  Shrink,
} from "lucide-react";
import type { ProductionBatch } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetKitchenQueueQuery,
  usePrepareUnitsMutation,
} from "@/redux/features/order/orderApi";
import { useGetStoreByIdQuery } from "@/redux/features/store/storeApi";
import { formatQuantity } from "@/utils/units";
import { SwipeCard } from "./swipe-card";
import { cn } from "@/lib/utils";

/**
 * Kitchen display. The cook works top-down: the API already groups identical
 * pastries from nearby orders, as far ahead as the store allows
 * (`kitchenBatchLookahead`, 0 = arrival order). On large screens nothing
 * scrolls the page: the action buttons stay visible and the "next" list
 * scrolls on its own.
 */
export default function KitchenPage() {
  const { store: storeId } = useParams<{ store: string }>();
  const { data: batches = [], isLoading } = useGetKitchenQueueQuery(storeId, {
    pollingInterval: 20_000,
  });
  const { data: store } = useGetStoreByIdQuery(storeId);
  const [prepare, { isLoading: saving }] = usePrepareUnitsMutation();
  const [soundOn, setSoundOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useNewBatchChime(batches, soundOn);

  const current = batches[0];
  const next = batches.slice(1);

  const markDone = useCallback(
    async (batch: ProductionBatch, all: boolean) => {
      const units = all
        ? batch.units.map(({ lineId, quantity }) => ({ lineId, quantity }))
        : [{ lineId: batch.units[0].lineId, quantity: 1 }];
      const made = units.reduce((sum, unit) => sum + unit.quantity, 0);

      await prepare({ storeId, units }).unwrap();
      toast.success(`${made}× ${batch.name} pronto${made > 1 ? "s" : ""}`, {
        duration: 6000,
        action: {
          label: "Desfazer",
          onClick: () =>
            prepare({ storeId, units: units.map((u) => ({ ...u, quantity: -u.quantity })) }),
        },
      });
    },
    [prepare, storeId]
  );

  // Space bar finishes the whole current batch (keyboard or tablet keyboard).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code !== "Space" || !current || saving || target.closest("button, input, textarea")) return;
      event.preventDefault();
      void markDone(current, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, markDone, saving]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen().catch(() => undefined);

  return (
    <div className="flex min-h-[calc(100svh-3rem)] flex-col gap-4 p-4 lg:h-[calc(100svh-3rem)] lg:min-h-0 lg:p-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChefHat className="size-6 text-primary" />
          <h1 className="text-xl font-bold">Cozinha</h1>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium tabular-nums">
            {batches.reduce((sum, batch) => sum + batch.quantity, 0)} na fila
          </span>
          {store && (
            <span className="hidden items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm text-muted-foreground sm:flex">
              <Layers className="size-3.5" />
              {store.kitchenBatchLookahead === 0
                ? "Ordem de chegada"
                : `Agrupa até ${store.kitchenBatchLookahead} ${store.kitchenBatchLookahead === 1 ? "pedido" : "pedidos"} à frente`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={soundOn ? "Desligar som de novos pedidos" : "Ligar som de novos pedidos"}
            aria-pressed={soundOn}
            onClick={() => setSoundOn((on) => !on)}
          >
            {soundOn ? <Bell /> : <BellOff />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Shrink /> : <Expand />}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-3 lg:grid-rows-1">
          <Skeleton className="min-h-80 rounded-3xl lg:col-span-2" />
          <Skeleton className="min-h-80 rounded-3xl" />
        </div>
      ) : !current ? (
        <EmptyKitchen />
      ) : (
        <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-3 lg:grid-rows-1">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={current.key + current.units.map((u) => u.lineId).join()}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="lg:col-span-2 lg:min-h-0"
            >
            <SwipeCard
              className="h-full"
              disabled={saving}
              rightLabel={current.quantity > 1 ? `Fiz todos (${current.quantity})` : "Pronto"}
              onSwipeRight={() => markDone(current, true)}
              leftLabel="Fiz 1"
              onSwipeLeft={() => markDone(current, false)}
            >
            <section
              aria-label="Fazer agora"
              className="flex h-full flex-col rounded-3xl border-2 border-primary/40 bg-card p-5 shadow-lg lg:min-h-0 lg:overflow-y-auto lg:p-8"
            >
              <p className="flex items-center justify-between gap-2 text-sm font-semibold tracking-wider text-primary uppercase">
                Fazer agora
                <span className="hidden text-xs font-normal tracking-normal text-muted-foreground normal-case sm:inline">
                  Arraste → pronto · ← fiz 1
                </span>
              </p>
              <div className="mt-2 flex items-baseline gap-4">
                <span className="text-7xl font-black tabular-nums lg:text-8xl">{current.quantity}×</span>
                <h2 className="text-3xl leading-tight font-bold text-balance lg:text-5xl">{current.name}</h2>
              </div>
              {fillingIcons(current).length > 0 && (
                <p className="mt-2 font-emoji text-5xl tracking-widest lg:text-6xl" aria-hidden>
                  {fillingIcons(current).join(" ")}
                </p>
              )}

              {current.addons.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {current.addons.map((addon) => (
                    <span key={addon} className="rounded-full bg-primary/10 px-3 py-1 text-lg font-semibold text-primary">
                      + {addon}
                    </span>
                  ))}
                </div>
              )}

              {current.notes && (
                <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-400/20 p-4 text-xl font-semibold text-amber-900 dark:text-amber-200">
                  <MessageSquareWarning className="mt-0.5 size-6 shrink-0" /> {current.notes}
                </p>
              )}

              {current.ingredients.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                    Separe para {current.quantity === 1 ? "este pastel" : `os ${current.quantity}`}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {current.ingredients.map((ingredient) => (
                      <li
                        key={ingredient.name}
                        className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-3"
                      >
                        <span
                          aria-hidden
                          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-background font-emoji text-3xl shadow-sm"
                        >
                          {ingredient.icon ?? "•"}
                        </span>
                        <span className="flex-1 text-xl font-medium">{ingredient.name}</span>
                        <span className="text-2xl font-bold tabular-nums">
                          {formatQuantity(ingredient.quantity, ingredient.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2" aria-label="Pedidos deste lote">
                {current.units.map((unit) => (
                  <span key={unit.lineId} className="rounded-xl border px-3 py-1.5 text-lg font-semibold tabular-nums">
                    #{unit.orderNumber}
                    {unit.quantity > 1 && <span className="text-muted-foreground"> · {unit.quantity}×</span>}
                  </span>
                ))}
              </div>

              {/* Always reachable: sticks to the screen (phones) or the card (large screens).
                  Its bottom follows the card's corners (rounded-3xl inside a 2px border). */}
              <div className="sticky bottom-0 z-10 -mx-5 mt-auto -mb-5 grid gap-3 rounded-b-[calc(1.5rem-2px)] bg-card/95 px-5 pt-6 pb-5 backdrop-blur sm:grid-cols-2 lg:-mx-8 lg:-mb-8 lg:px-8 lg:pb-8">
                {current.quantity > 1 && (
                  <Button
                    variant="outline"
                    className="h-16 rounded-2xl text-xl"
                    disabled={saving}
                    onClick={() => markDone(current, false)}
                  >
                    <Check className="size-6" /> Fiz 1
                  </Button>
                )}
                <Button
                  className={cn("h-16 rounded-2xl text-xl", current.quantity === 1 && "sm:col-span-2")}
                  disabled={saving}
                  onClick={() => markDone(current, true)}
                >
                  <CheckCheck className="size-6" />
                  {current.quantity > 1 ? `Fiz todos (${current.quantity})` : "Pronto"}
                </Button>
              </div>
            </section>
            </SwipeCard>
            </motion.div>
          </AnimatePresence>

          <aside aria-label="Próximos" className="flex flex-col gap-3 lg:min-h-0">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Próximos {next.length > 0 && `(${next.length})`}
            </h2>
            {next.length === 0 && (
              <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
                Nada depois deste lote.
              </p>
            )}
            <ul className="flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:scroll-fade-y">
              <AnimatePresence initial={false}>
                {next.map((batch, index) => (
                  <motion.li
                    key={batch.key + batch.units.map((u) => u.lineId).join()}
                    layout
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    className={cn("rounded-2xl border bg-card p-4", index === 0 && "border-primary/30")}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black tabular-nums">{batch.quantity}×</span>
                      <span className="flex-1 text-lg font-semibold">{batch.name}</span>
                      {fillingIcons(batch).length > 0 && (
                        <span className="font-emoji text-2xl" aria-hidden>
                          {fillingIcons(batch).join("")}
                        </span>
                      )}
                    </div>
                    {(batch.addons.length > 0 || batch.notes) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {batch.addons.map((a) => `+ ${a}`).join(" ")}
                        {batch.notes && <span className="font-medium text-amber-700 dark:text-amber-300"> “{batch.notes}”</span>}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {batch.units.map((u) => `#${u.orderNumber}`).join(" · ")}
                    </p>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </aside>
        </div>
      )}
    </div>
  );
}

/** The filling at a glance: ingredient emoji except the dough every pastry has. */
function fillingIcons(batch: ProductionBatch) {
  return [
    ...new Set(
      batch.ingredients.flatMap((ingredient) =>
        ingredient.icon && ingredient.icon !== "🥟" ? [ingredient.icon] : []
      )
    ),
  ].slice(0, 4);
}

function EmptyKitchen() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-10 text-center"
    >
      <ChefHat className="size-16 text-primary" />
      <p className="text-2xl font-bold">Tudo pronto por aqui!</p>
      <p className="text-muted-foreground">Os próximos pedidos aparecem sozinhos nesta tela.</p>
    </motion.div>
  );
}

/** Short beep when a new batch shows up (opt-in: browsers block audio until a tap). */
function useNewBatchChime(batches: ProductionBatch[], enabled: boolean) {
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    const keys = new Set(batches.flatMap((b) => b.units.map((u) => `${u.lineId}`)));
    const previous = known.current;
    known.current = keys;
    if (!enabled || !previous) return;
    if (![...keys].some((key) => !previous.has(key))) return;

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.4);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
    oscillator.onended = () => void context.close();
  }, [batches, enabled]);
}
