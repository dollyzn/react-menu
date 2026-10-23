"use client";

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useRehydrated } from "@/hooks/use-rehydrated";
import { homeForRole } from "@/lib/menu-itens";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/redux/hooks";

/**
 * "Painel" in the customer pages' header for staff signed in on this device:
 * straight to this store's panel (their role's home), or their first store.
 * Rendered only after the persisted session is restored, so the server HTML
 * customers get stays the same.
 */
export function PanelShortcut({ storeSlug }: { storeSlug?: string }) {
  const rehydrated = useRehydrated();
  const user = useAppSelector((state) => state.auth.user);
  if (!rehydrated || !user) return null;

  const store = user.stores.find((candidate) => candidate.slug === storeSlug) ?? user.stores[0];
  if (!store && !user.superUser) return null;
  const href = store ? homeForRole(store.id, store.role) : "/app/stores";

  return (
    <Link
      href={href}
      aria-label="Abrir o painel"
      title="Abrir o painel"
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 shrink-0 rounded-full px-3")}
    >
      <LayoutDashboard />
      <span className="hidden sm:inline">Painel</span>
    </Link>
  );
}
