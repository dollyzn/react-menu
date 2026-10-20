"use client";

import { useState } from "react";
import { AnimatePresence, delay, motion } from "framer-motion";
import { useSession } from "@/contexts/session-provider";
import { useRouter } from "next/navigation";
import useDebouncedEffect from "@/hooks/use-debonced-effect";
import { toast } from "sonner";
import { redirectToLogin } from "@/utils/navigation";
import { Icons } from "@/components/app/icons";

export default function LogoutPage() {
  const { logout } = useSession();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useDebouncedEffect(
    () => {
      delay(async () => {
        await logout();
        setRedirecting(true);
        delay(() => {
          toast.success("Sessão encerrada com sucesso.", {
            id: "logout-success",
          });
          redirectToLogin(router);
        }, 1500);
      }, 1000);
    },
    [logout],
    200
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center p-6 space-y-2 bg-background text-foreground">
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
