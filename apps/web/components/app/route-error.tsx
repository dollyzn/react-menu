"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { RotateCw, TriangleAlert, WifiOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusScreen } from "@/components/app/status-screen";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );

interface RouteErrorProps {
  error: unknown;
  retry: () => void;
  /** Where the secondary action goes ("/" for customers, the panel for staff). */
  home: { href: string; label: string; icon: LucideIcon };
  className?: string;
}

/**
 * Body of the error.tsx boundaries. Offline gets its own message and the
 * page retries by itself when the connection comes back (beach wifi).
 */
export function RouteError({ error, retry, home, className }: RouteErrorProps) {
  const online = useOnline();
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  useEffect(() => {
    if (online) return;
    const onBack = () => retry();
    window.addEventListener("online", onBack, { once: true });
    return () => window.removeEventListener("online", onBack);
  }, [online, retry]);

  const HomeIcon = home.icon;

  return (
    <StatusScreen
      className={className}
      icon={online ? TriangleAlert : WifiOff}
      title={online ? "Algo deu errado" : "Você está sem conexão"}
      description={
        online
          ? "Não conseguimos carregar esta página agora. Pode ser uma instabilidade rápida: tente de novo em alguns segundos."
          : "Assim que a internet voltar, a página carrega sozinha. Se preferir, tente de novo manualmente."
      }
      reference={digest}
    >
      <Button size="lg" onClick={() => retry()}>
        <RotateCw />
        Tentar novamente
      </Button>
      <Link href={home.href} className={buttonVariants({ variant: "outline", size: "lg" })}>
        <HomeIcon />
        {home.label}
      </Link>
    </StatusScreen>
  );
}
