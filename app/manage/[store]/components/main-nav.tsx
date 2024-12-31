"use client";

import { usePathname, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function MainNav() {
  const { store } = useParams();
  const pathname = usePathname();

  return (
    <div className="mr-4 hidden sm:flex items-center">
      <nav className="flex items-center gap-4 text-sm xl:gap-6">
        <Link
          href={`/manage/${store}/overview`}
          className={cn(
            "transition-colors hover:text-foreground/80 hover:border-foreground/80",
            pathname === `/manage/${store}/overview`
              ? "text-foreground border-b border-foreground"
              : "text-foreground/80"
          )}
        >
          Visão Geral
        </Link>
        <Link
          href={`/manage/${store}/categories`}
          className={cn(
            "transition-colors hover:text-foreground/80 hover:border-foreground/80",
            pathname === `/manage/${store}/categories`
              ? "text-foreground border-b border-foreground"
              : "text-foreground/80"
          )}
        >
          Categorias
        </Link>
        <Link
          href={`/manage/${store}/items`}
          className={cn(
            "transition-colors hover:text-foreground/80 hover:border-foreground/80",
            pathname === `/manage/${store}/items`
              ? "text-foreground border-b border-foreground"
              : "text-foreground/80"
          )}
        >
          Items
        </Link>
        <Link
          href={`/manage/${store}/addons`}
          className={cn(
            "transition-colors hover:text-foreground/80 hover:border-foreground/80",
            pathname === `/manage/${store}/addons`
              ? "text-foreground border-b border-foreground"
              : "text-foreground/80"
          )}
        >
          Adicionais
        </Link>
      </nav>
    </div>
  );
}
