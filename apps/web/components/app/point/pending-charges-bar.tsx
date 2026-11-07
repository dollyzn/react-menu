"use client";

import { AnimatePresence, motion } from "motion/react";
import { SmartphoneNfc } from "lucide-react";
import type { PointCharge } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { useGetPendingPointChargesQuery, useGetPointConfigQuery } from "@/redux/features/point/pointApi";
import { formatCurrencyBRL } from "@/utils/string";

/**
 * "Na maquininha": the store's charges still waiting on a card machine, so a
 * dialog closed by mistake (or a charge sent from another screen) can be
 * opened again. While any is waiting, Mercado Pago is asked about them too,
 * so one paid without a webhook leaves the list.
 */
export function PendingChargesBar({
  storeId,
  onOpen,
}: {
  storeId: string;
  onOpen: (charge: PointCharge) => void;
}) {
  const { data: config } = useGetPointConfigQuery(storeId);
  const enabled = Boolean(config?.available && config.terminals.length > 0);
  const { data: idle } = useGetPendingPointChargesQuery(
    { storeId },
    { skip: !enabled, pollingInterval: 5000, skipPollingIfUnfocused: true }
  );
  const waiting = (idle?.length ?? 0) > 0;
  const { data: checked } = useGetPendingPointChargesQuery(
    { storeId, check: true },
    { skip: !enabled || !waiting, pollingInterval: 8000, skipPollingIfUnfocused: true }
  );
  const charges = (waiting ? (checked ?? idle) : idle) ?? [];

  const now = useNow(1000);

  return (
    <AnimatePresence initial={false}>
      {charges.length > 0 && (
        <motion.section
          aria-label="Na maquininha"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <ul className="flex flex-col divide-y divide-primary/15 overflow-hidden rounded-2xl border border-primary/25 bg-primary/5">
            {charges.map((charge) => {
              const left = charge.expiresAt
                ? Math.max(0, Math.floor((new Date(charge.expiresAt).getTime() - now) / 1000))
                : null;
              return (
                <li key={charge.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="relative flex size-2.5 shrink-0" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">Na maquininha</span>
                      <span className="truncate text-muted-foreground">
                        Pedido #{charge.order.number} · {charge.order.customerName}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      <SmartphoneNfc className="mr-1 inline size-3.5 align-[-2px]" />
                      {charge.terminalName ?? "Maquininha"}
                      {left !== null && ` · expira em ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}
                    </span>
                  </span>
                  <span className="text-base font-bold tabular-nums">{formatCurrencyBRL(charge.amount)}</span>
                  <Button size="sm" variant="outline" className="border-primary/30 bg-background" onClick={() => onOpen(charge)}>
                    Abrir
                  </Button>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
