"use client";

import Link from "next/link";
import { Handshake, Lock } from "lucide-react";
import { StatusScreen } from "@/components/app/status-screen";
import { buttonVariants } from "@/components/ui/button";
import { usePartnerRole, useStoreRole } from "@/hooks/use-store-role";
import { useHydrated } from "@/hooks/use-hydrated";
import { homeForRole } from "@/lib/menu-itens";

/**
 * The partner area (ADR 0024) is only for partners; the API refuses
 * everyone else anyway. Nothing renders until the session says who it is,
 * so no request goes out on someone else's behalf.
 */
export function PartnerAreaGate({
  storeId,
  managersOnly = false,
  children,
}: {
  storeId: string;
  /** The commission: the partner's managers only (attendants only sell). */
  managersOnly?: boolean;
  children: React.ReactNode;
}) {
  const hydrated = useHydrated();
  const role = useStoreRole(storeId);
  const partnerRole = usePartnerRole(storeId);
  if (!hydrated || !role) return null;
  if (role === "partner" && managersOnly && partnerRole !== "manager") {
    return (
      <StatusScreen
        icon={Lock}
        title="Só para quem gerencia o parceiro"
        description="A comissão aparece para o gerente do parceiro. Você continua vendendo e acompanhando os pedidos."
        className="min-h-[calc(100svh-3rem)]"
      >
        <Link href={`/app/stores/${storeId}/partner`} className={buttonVariants()}>
          Ir para Vender
        </Link>
      </StatusScreen>
    );
  }
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
