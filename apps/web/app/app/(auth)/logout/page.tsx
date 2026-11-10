"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, delay, motion } from "motion/react";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useSession } from "@/contexts/session-provider";
import useDebouncedEffect from "@/hooks/use-debonced-effect";
import { redirectToLogin } from "@/utils/navigation";
import { Icons } from "@/components/app/icons";
import { StatusScreen } from "@/components/app/status-screen";
import { Button, buttonVariants } from "@/components/ui/button";
import { clearLogoutRequest, logoutRequested } from "@/lib/logout-intent";

/**
 * Signing out. The panel's own "Sair" signs out at once; anything else (a
 * link from another site, which arrives signed in with the SameSite=Lax
 * cookie, or the URL typed by hand) asks first, so a link can't sign anyone
 * out (ADR 0019).
 */
export default function LogoutPage() {
  const { logout } = useSession();
  const [confirmed, setConfirmed] = useState(() => logoutRequested());
  const [redirecting, setRedirecting] = useState(false);

  useDebouncedEffect(
    () => {
      if (!confirmed) return;
      delay(async () => {
        await logout();
        clearLogoutRequest();
        setRedirecting(true);
        delay(() => redirectToLogin(), 1500);
      }, 1000);
    },
    [logout, confirmed],
    200
  );

  if (!confirmed) {
    return (
      <StatusScreen
        icon={LogOut}
        title="Sair da conta?"
        description="Você vai precisar entrar de novo, com o código, para usar o painel neste aparelho."
      >
        <Link href="/app/stores" className={buttonVariants({ size: "lg" })}>
          <LayoutDashboard />
          Voltar ao painel
        </Link>
        <Button variant="outline" size="lg" onClick={() => setConfirmed(true)}>
          <LogOut />
          Sair
        </Button>
      </StatusScreen>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center p-6 gap-2 bg-background text-foreground">
      <div className="relative">
        <div className="absolute inset-0 bg-primary rounded-full blur-xl animate-pulse" />
        <Icons.logo className="size-8 fill-primary" />
      </div>

      <div>
        <p className="text-2xl font-semibold items-center">
          Encerrando sessão{" "}
          <span className="animate-ping [animation-delay:-0.3s]">.</span>
          <span className="animate-ping [animation-delay:-0.15s]">.</span>
          <span className="animate-ping">.</span>
        </p>

        <AnimatePresence mode="wait">
          {!redirecting ? (
            <motion.p
              key="loging-out"
              exit={{ opacity: 0 }}
              className="text-muted-foreground text-sm"
            >
              Aguarde enquanto finalizamos sua sessão...
            </motion.p>
          ) : (
            <motion.p
              key="redirecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground text-sm"
            >
              Você será redirecionado em instantes...
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
