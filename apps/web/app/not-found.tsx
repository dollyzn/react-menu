import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, SearchX, UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusScreen } from "@/components/app/status-screen";

export const metadata: Metadata = { title: "Página não encontrada" };

/** Unmatched URLs and notFound() outside more specific segments. */
export default function NotFound() {
  return (
    <StatusScreen
      icon={SearchX}
      code="404"
      title="Página não encontrada"
      description="O endereço pode estar errado ou a página não existe mais. Que tal voltar ao cardápio?"
    >
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        <UtensilsCrossed />
        Ver o cardápio
      </Link>
      <Link href="/pedidos" className={buttonVariants({ variant: "outline", size: "lg" })}>
        <ReceiptText />
        Meus pedidos
      </Link>
    </StatusScreen>
  );
}
