"use client";

import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { useGetOrderHistoryQuery } from "@/redux/features/public/publicApi";
import { isActiveOrder } from "../_lib/customer-orders";

/**
 * Link to "Meus pedidos". Always rendered (server included) so nothing pops
 * in after F5; only the "order in progress" dot depends on this device.
 */
export function RecentOrdersButton() {
  const rehydrated = useRehydrated();
  const recent = useAppSelector((state) => state.customer.recentOrders);
  const tokenMap = useAppSelector((state) => state.customer.tokens);
  const tokens = recent.map((order) => order.publicToken);
  const links = Object.entries(tokenMap ?? {}).map(([storeSlug, token]) => ({ storeSlug, token }));

  const { data } = useGetOrderHistoryQuery(
    { tokens, links },
    { skip: !rehydrated || (tokens.length === 0 && links.length === 0) }
  );
  const inProgress = data?.orders.filter((order) => isActiveOrder(order.status)).length ?? 0;

  return (
    // A real link (not role="button"): it navigates to another page.
    <Link
      href="/pedidos"
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative rounded-full")}
      aria-label={inProgress > 0 ? `Meus pedidos (${inProgress} em andamento)` : "Meus pedidos"}
    >
      <ReceiptText />
      {inProgress > 0 && (
        <span className="absolute top-1.5 right-1.5 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
        </span>
      )}
    </Link>
  );
}
