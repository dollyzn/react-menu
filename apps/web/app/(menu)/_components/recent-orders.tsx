"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, ReceiptText } from "lucide-react";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/redux/hooks";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { formatCurrencyBRL } from "@/utils/string";

/** Orders placed from this device, kept locally (no customer account). */
export function RecentOrdersButton() {
  const rehydrated = useRehydrated();
  const orders = useAppSelector((state) => state.customer.recentOrders);
  const [open, setOpen] = useState(false);

  if (!rehydrated || orders.length === 0) return null;

  return (
    <>
      <Button variant="ghost" size="icon" className="rounded-full" aria-label="Meus pedidos" onClick={() => setOpen(true)}>
        <ReceiptText />
      </Button>
      <ResponsiveModal open={open} onOpenChange={setOpen} title="Meus pedidos" description="Pedidos feitos neste aparelho">
        <ul className="divide-y p-2">
          {orders.map((order) => (
            <li key={order.publicToken}>
              <Link
                href={`/pedido/${order.publicToken}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/60"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                  #{order.number}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{order.storeName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(order.createdAt), { addSuffix: true, locale: ptBR })} ·{" "}
                    {formatCurrencyBRL(order.total)}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </ResponsiveModal>
    </>
  );
}
