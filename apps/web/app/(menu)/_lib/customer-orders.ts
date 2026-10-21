"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, ChefHat, CreditCard, PartyPopper, ReceiptText, ShoppingBag, type LucideIcon } from "lucide-react";
import type { OrderStatus } from "@react-menu/contracts";
import { useAppDispatch } from "@/redux/hooks";
import { addLine } from "@/redux/slices/cart";
import { publicApi } from "@/redux/features/public/publicApi";

/** How each status reads for the customer. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; icon: LucideIcon; tone: string }> = {
  pending_payment: { label: "Aguardando pagamento", icon: CreditCard, tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  received: { label: "Na fila da cozinha", icon: ReceiptText, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  preparing: { label: "Em preparo", icon: ChefHat, tone: "bg-primary/15 text-primary" },
  ready: { label: "Pronto para retirar", icon: ShoppingBag, tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  completed: { label: "Retirado", icon: PartyPopper, tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", icon: Ban, tone: "bg-destructive/10 text-destructive" },
};

/** Steps the customer follows on the tracking page and history cards. */
export const PROGRESS: OrderStatus[] = ["received", "preparing", "ready", "completed"];

export const isActiveOrder = (status: OrderStatus) =>
  status !== "completed" && status !== "cancelled";

/** Link shared with another device to see the same order history. */
export const linkUrl = (storeSlug: string, token: string) =>
  `${window.location.origin}/pedidos?vincular=${encodeURIComponent(`${storeSlug}.${token}`)}`;

/**
 * "Pedir de novo": rebuilds the bag from a past order using the current
 * menu (current prices; unavailable items and add-ons are skipped).
 */
export function useReorder() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  return async (publicToken: string, storeSlug: string) => {
    try {
      const [order, menu] = await Promise.all([
        dispatch(publicApi.endpoints.getPublicOrder.initiate(publicToken)).unwrap(),
        dispatch(publicApi.endpoints.getPublicMenu.initiate({ slug: storeSlug })).unwrap(),
      ]);
      const items = new Map(menu.categories.flatMap((c) => c.items).map((item) => [item.id, item]));

      let added = 0;
      let skipped = 0;
      for (const line of order.items) {
        const item = line.itemId ? items.get(line.itemId) : undefined;
        if (!item?.isAvailable) {
          skipped += line.quantity;
          continue;
        }
        const addons = line.addons.flatMap((addon) => {
          const current = item.addons.find((a) => a.id === addon.addonId && a.isAvailable);
          return current ? [{ id: current.id, name: current.name, price: current.price }] : [];
        });
        dispatch(
          addLine({
            storeSlug,
            line: {
              itemId: item.id,
              name: item.name,
              photoUrl: item.photoUrl,
              unitPrice: item.price,
              addons,
              notes: line.notes ?? "",
              quantity: line.quantity,
            },
          })
        );
        added += line.quantity;
      }

      if (added === 0) {
        toast.error("Os itens desse pedido não estão disponíveis agora.");
        return;
      }
      toast.success(
        skipped > 0
          ? `${added} ${added === 1 ? "item voltou" : "itens voltaram"} para a sacola (${skipped} indisponível${skipped > 1 ? "is" : ""}).`
          : "Pedido de novo na sacola! Confira e finalize."
      );
      router.push(`/${storeSlug}?sacola=1`);
    } catch {
      // baseApi already showed the error.
    }
  };
}
