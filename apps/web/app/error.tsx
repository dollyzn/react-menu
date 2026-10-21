"use client";

import { UtensilsCrossed } from "lucide-react";
import { RouteError } from "@/components/app/route-error";

/** Errors in any page below the root layout (menu, order tracking, login...). */
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <RouteError
      error={error}
      retry={retry}
      home={{ href: "/", label: "Ir para o cardápio", icon: UtensilsCrossed }}
    />
  );
}
