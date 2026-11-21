"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, MoreHorizontal, Pause, Play, UserPlus } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import type { StorePartner } from "@react-menu/contracts";
import { AlertDialogDestructive } from "@/components/app/alert-dialog-destructive";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePausePartnerMutation } from "@/redux/features/partner/partnersApi";

/** Abrir / Convidar pessoa / Pausar vendas of a partner (table row, phone card and the partner's page). */
export function PartnerActions({
  partner,
  size = "icon",
  showOpen = true,
}: {
  partner: StorePartner;
  size?: VariantProps<typeof buttonVariants>["size"];
  showOpen?: boolean;
}) {
  const { store } = useParams<{ store: string }>();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pause, { isLoading }] = usePausePartnerMutation();
  const paused = Boolean(partner.pausedAt);

  const toggle = async () => {
    await pause({ storeId: store, partnerId: partner.id, paused: !paused }).unwrap();
    setConfirming(false);
    toast.success(paused ? `Vendas de ${partner.name} liberadas` : `Vendas de ${partner.name} pausadas`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size={size} className="flex p-0 data-[state=open]:bg-muted" />}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal />
          <span className="sr-only">Ações de {partner.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44" onClick={(event) => event.stopPropagation()}>
          {showOpen && (
            <DropdownMenuItem render={<Link href={`/app/stores/${store}/partners/${partner.id}`} />}>
              <ArrowUpRight /> Abrir
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => router.push(`/app/stores/${store}/members`)}>
            <UserPlus /> Convidar pessoa
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {paused ? (
            <DropdownMenuItem onClick={() => void toggle()}>
              <Play /> Liberar vendas
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              <Pause /> Pausar vendas
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialogDestructive
        open={confirming}
        onOpenChange={setConfirming}
        loading={isLoading}
        title={`Pausar as vendas de ${partner.name}?`}
        description="O parceiro continua vendo os pedidos e a comissão, mas não consegue vender até você liberar de novo."
        confirmLabel="Pausar vendas"
        onConfirm={toggle}
      />
    </>
  );
}
