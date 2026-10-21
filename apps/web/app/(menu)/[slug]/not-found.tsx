import type { Metadata } from "next";
import Link from "next/link";
import { StoreIcon, UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusScreen } from "@/components/app/status-screen";

export const metadata: Metadata = { title: "Loja não encontrada" };

/** /[slug] for a store that doesn't exist (or was renamed). */
export default function StoreNotFound() {
  return (
    <StatusScreen
      icon={StoreIcon}
      code="404"
      title="Loja não encontrada"
      description="Não achamos um cardápio neste endereço. Confira o link que você recebeu ou peça um novo à loja."
    >
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        <UtensilsCrossed />
        Ir para o cardápio principal
      </Link>
    </StatusScreen>
  );
}
