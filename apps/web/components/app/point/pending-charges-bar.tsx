"use client";

import { AnimatePresence, motion } from "motion/react";
import { CreditCard } from "lucide-react";
import type { PointCharge } from "@react-menu/contracts";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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
          <ul className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-2">
            {charges.map((charge) => (
              <li key={charge.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CreditCard className="size-4" />
                  <Spinner className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-background text-primary" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">
                    Pedido #{charge.order.number} · {formatCurrencyBRL(charge.amount)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Aguardando na {charge.terminalName ?? "maquininha"} · {charge.order.customerName}
                  </span>
                </span>
                <Button size="sm" onClick={() => onOpen(charge)}>
                  Abrir
                </Button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
