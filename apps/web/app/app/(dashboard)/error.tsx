"use client";

import { LayoutDashboard } from "lucide-react";
import { RouteError } from "@/components/app/route-error";

/** Panel page errors: shown inside the shell, so the sidebar keeps working. */
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <RouteError
      error={error}
      retry={retry}
      home={{ href: "/app/stores", label: "Voltar ao painel", icon: LayoutDashboard }}
      className="min-h-[calc(100dvh-4rem)]"
    />
  );
}
