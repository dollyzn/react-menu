import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Icons } from "@/components/app/icons";
import { ThemeToggleButton } from "@/components/app/theme-toggle-button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Shared frame of /privacy and /terms. */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}>
            <ArrowLeft /> Voltar ao cardápio
          </Link>
          <ThemeToggleButton />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Icons.logo className="size-5 fill-primary" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="text-sm text-muted-foreground">Atualizado em {updatedAt}</p>
          </div>
        </div>

        <article
          className={cn(
            "mt-8 space-y-4 leading-relaxed text-muted-foreground",
            "[&_h2]:mt-10 [&_h2]:scroll-mt-20 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground",
            "[&_strong]:font-medium [&_strong]:text-foreground",
            "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
            "[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline"
          )}
        >
          {children}
        </article>

        <nav aria-label="Documentos" className="mt-12 flex gap-4 border-t pt-6 text-sm">
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Termos de Uso
          </Link>
        </nav>
      </main>
    </div>
  );
}
