import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, SearchX, UtensilsCrossed } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusScreen } from "@/components/app/status-screen";

export const metadata: Metadata = { title: "Página não encontrada" };

/** Panel 404 (unknown /app/* URLs and notFound() in staff pages). */
export default function StaffNotFound() {
  return (
    <StatusScreen
      icon={SearchX}
      code="404"
      title="Página não encontrada"
      description="Esta página do painel não existe ou o link está incompleto. Volte para as suas lojas e siga pelo menu."
    >
      <Link href="/app/stores" className={buttonVariants({ size: "lg" })}>
        <LayoutDashboard />
        Voltar ao painel
      </Link>
      <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
        <UtensilsCrossed />
        Ver o cardápio
      </Link>
    </StatusScreen>
  );
}
