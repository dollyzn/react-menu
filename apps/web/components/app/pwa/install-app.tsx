"use client";

import { useState } from "react";
import Image from "@/components/app/image";
import { AnimatePresence, motion } from "motion/react";
import { Download, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveModal } from "@/components/app/responsive-modal";
import { Button } from "@/components/ui/button";
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { isInstallSnoozed, snoozeInstall, type InstallContext } from "@/lib/install-prompt-storage";
import { cn } from "@/lib/utils";

/**
 * Native prompt where supported, step-by-step sheet on iOS. Render `steps`
 * outside menus/popovers so it survives them closing.
 */
export function useInstallFlow(context: InstallContext) {
  const pwa = usePwaInstall();
  const [stepsOpen, setStepsOpen] = useState(false);

  const install = async () => {
    if (pwa.needsManualSteps) return setStepsOpen(true);
    const outcome = await pwa.promptInstall();
    if (outcome === "accepted") toast.success("App instalado! Ele já está na sua tela inicial.");
    if (outcome === "dismissed") snoozeInstall(context);
  };

  const steps = <IosInstallSteps open={stepsOpen} onOpenChange={setStepsOpen} />;
  return { pwa, install, steps };
}

interface InstallAppCardProps {
  context: InstallContext;
  title: string;
  description: string;
  variant?: "inline" | "sidebar";
  /** Extra condition to wait for engagement (e.g. a returning visit). */
  when?: boolean;
  className?: string;
}

/**
 * Invitation to install the app. Shows only when the browser can install it,
 * the user hasn't said "not now" recently and `when` holds.
 */
export function InstallAppCard({
  context,
  title,
  description,
  variant = "inline",
  when = true,
  className,
}: InstallAppCardProps) {
  const { pwa, install, steps } = useInstallFlow(context);
  const [dismissed, setDismissed] = useState(false);
  // pwa.available is false on the server, so storage is read only on the client.
  const visible = pwa.available && when && !dismissed && !isInstallSnoozed(context);

  const notNow = () => {
    snoozeInstall(context);
    setDismissed(true);
  };

  const sidebar = variant === "sidebar";

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.aside
            aria-label="Instalar o app"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
            className={cn(
              "relative overflow-hidden border bg-card bg-linear-to-br from-primary/10 via-transparent to-transparent",
              sidebar
                ? "rounded-xl p-3 group-data-[collapsible=icon]:hidden"
                : "flex flex-col gap-4 rounded-2xl p-4 shadow-sm sm:flex-row sm:items-center",
              className
            )}
          >
            <div className={cn("flex gap-3", sidebar ? "items-center" : "flex-1 items-start sm:items-center")}>
              <Image
                src="/icons/icon-192.png"
                alt=""
                width={sidebar ? 32 : 48}
                height={sidebar ? 32 : 48}
                loading="eager"
                className={cn("shrink-0 shadow-sm", sidebar ? "rounded-lg" : "rounded-xl")}
              />
              <div className="min-w-0 flex-1">
                <p className={cn("font-semibold", sidebar && "text-sm")}>{title}</p>
                <p className={cn("text-muted-foreground", sidebar ? "text-xs" : "mt-0.5 text-sm")}>{description}</p>
              </div>
            </div>
            <div className={cn("flex gap-2", sidebar ? "mt-3" : "shrink-0 justify-end")}>
              <Button variant="ghost" size="sm" className={cn(sidebar && "flex-1")} onClick={notNow}>
                Agora não
              </Button>
              <Button size="sm" className={cn("rounded-full", sidebar && "flex-1")} onClick={install}>
                <Download /> Instalar
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {steps}
    </>
  );
}

/** "Instalar app" entry for a user menu; pair it with `useInstallFlow`. */
export function InstallAppMenuGroup({ onInstall }: { onInstall: () => void }) {
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={onInstall}>
          <Download className="mr-1 h-4 w-4" />
          Instalar app
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}

const IOS_STEPS = [
  { icon: Share, text: <>Toque em <strong>Compartilhar</strong> na barra do navegador.</> },
  { icon: SquarePlus, text: <>Escolha <strong>Adicionar à Tela de Início</strong>.</> },
  { icon: Download, text: <>Toque em <strong>Adicionar</strong>. Pronto: o app abre pela tela inicial.</> },
];

/** iOS has no install prompt API: show how to add it from the Share menu. */
function IosInstallSteps({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Instalar no iPhone"
      description="Três toques e o app fica na sua tela inicial."
      className="sm:max-w-sm"
    >
      <ol className="space-y-3 p-4">
        {IOS_STEPS.map((step, index) => (
          <li key={index} className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
              <step.icon className="size-5" />
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
      <div className="p-4 pt-0">
        <Button className="w-full rounded-full" onClick={() => onOpenChange(false)}>
          Entendi
        </Button>
      </div>
    </ResponsiveModal>
  );
}
