"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function MainNav() {
  const pathname = usePathname();

  return (
    <div className="mr-4 hidden sm:flex items-center">
      <nav className="flex items-center gap-4 text-sm xl:gap-6">
        <Link
          href="/manage/overview"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/manage/overview"
              ? "text-foreground"
              : "text-foreground/80"
          )}
        >
          Visão Geral
        </Link>
        <Link
          href="/manage/categories"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/manage/categories"
              ? "text-foreground"
              : "text-foreground/80"
          )}
        >
          Categorias
        </Link>
        <Link
          href="/manage/items"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/manage/items"
              ? "text-foreground"
              : "text-foreground/80"
          )}
        >
          Items
        </Link>
        <Link
          href="/manage/addons"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/manage/addons"
              ? "text-foreground"
              : "text-foreground/80"
          )}
        >
          Adicionais
        </Link>
      </nav>
    </div>
  );
}
