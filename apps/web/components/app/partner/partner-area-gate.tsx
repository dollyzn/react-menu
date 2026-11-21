"use client";

import Link from "next/link";
import { Handshake } from "lucide-react";
import { StatusScreen } from "@/components/app/status-screen";
import { buttonVariants } from "@/components/ui/button";
import { useStoreRole } from "@/hooks/use-store-role";
import { useHydrated } from "@/hooks/use-hydrated";
import { homeForRole } from "@/lib/menu-itens";

/**
 * The partner area (ADR 0024) is only for partners; the API refuses
 * everyone else anyway. Nothing renders until the session says who it is,
 * so no request goes out on someone else's behalf.
 */
export function PartnerAreaGate({ storeId, children }: { storeId: string; children: React.ReactNode }) {
  const hydrated = useHydrated();
  const role = useStoreRole(storeId);
  if (!hydrated || !role) return null;
  if (role !== "partner") {
    return (
      <StatusScreen
        icon={Handshake}
        title="Área de parceiros"
        description="Esta tela é dos parceiros que vendem o cardápio da loja. Os parceiros da loja ficam em Parceiros."
        className="min-h-[calc(100svh-3rem)]"
      >
        <Link href={homeForRole(storeId, role)} className={buttonVariants()}>
          Voltar para a loja
        </Link>
      </StatusScreen>
    );
  }
  return <>{children}</>;
}
