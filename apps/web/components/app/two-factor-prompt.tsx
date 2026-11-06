"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { NavLinkWrapper } from "@/components/app/layout/nav-link-wrapper";
import { useSession } from "@/contexts/session-provider";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { isTwoFactorPromptSnoozed, snoozeTwoFactorPrompt } from "@/lib/two-factor-prompt-storage";

/**
 * A quiet invitation in the sidebar (like the one to install the app) to set
 * up an authenticator app, while sign-ins still use the e-mail code. "Agora
 * não" rests it for a week; it isn't shown on the settings page itself. With
 * the sidebar collapsed to icons it is a shield with a dot (and a tooltip).
 */
export function TwoFactorPrompt() {
  const { user } = useSession();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  // Storage is read only after hydration (the server can't).
  const visible =
    hydrated &&
    Boolean(user) &&
    !user?.twoFactorEnabled &&
    !dismissed &&
    !pathname.startsWith("/app/settings") &&
    !isTwoFactorPromptSnoozed();

  const href = "/app/settings#verificacao-em-duas-etapas";

  return (
    <AnimatePresence>
      {visible && (
        <SidebarMenu key="compact" className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Proteja sua conta" render={<NavLinkWrapper to={href} />} className="relative">
              <ShieldCheck className="text-primary" />
              <span className="absolute top-1.5 right-1.5 size-2 animate-pulse rounded-full bg-primary" aria-hidden />
              <span className="truncate">Proteja sua conta</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      )}
      {visible && (
        <motion.aside
          key="card"
          aria-label="Proteger a conta"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
          className="relative overflow-hidden rounded-xl border bg-card bg-linear-to-br from-primary/10 via-transparent to-transparent p-3 group-data-[collapsible=icon]:hidden"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Proteja sua conta</p>
              <p className="text-xs text-muted-foreground">Use um app autenticador e entre sem esperar e-mail.</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                snoozeTwoFactorPrompt();
                setDismissed(true);
              }}
            >
              Agora não
            </Button>
            <Link
              href={href}
              className={cn(buttonVariants({ size: "sm" }), "flex-1 rounded-full")}
            >
              Configurar
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
