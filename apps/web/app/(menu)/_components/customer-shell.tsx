import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggleButton } from "@/components/app/theme-toggle-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelShortcut } from "./panel-shortcut";

/** Header + narrow column used by the customer's order pages. */
export function CustomerShell({
  children,
  backHref = "/",
  backLabel = "Cardápio",
  actions,
}: {
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-4">
          <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
            <ArrowLeft /> {backLabel}
          </Link>
          <div className="flex items-center gap-1">
            {actions}
            <PanelShortcut />
            <ThemeToggleButton className="rounded-full" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
