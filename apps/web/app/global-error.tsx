"use client";

import "@/styles/globals.css";

import { useEffect } from "react";
import { UtensilsCrossed } from "lucide-react";
import { RouteError } from "@/components/app/route-error";
import { fontMono, fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";

/**
 * Errors in the root layout itself (providers). Replaces the whole document,
 * so it brings its own <html>, styles and theme (no inline <script>: React
 * never runs scripts it renders on the client).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    let theme = "system";
    try {
      theme = localStorage.getItem("theme") ?? "system";
    } catch {}
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return (
    <html lang="pt-BR" className={cn("font-sans antialiased", fontSans.variable, fontMono.variable)}>
      <body className="min-h-screen bg-background text-foreground">
        <title>Algo deu errado | React Menu</title>
        <RouteError
          error={error}
          retry={retry}
          home={{ href: "/", label: "Ir para o cardápio", icon: UtensilsCrossed }}
        />
      </body>
    </html>
  );
}
