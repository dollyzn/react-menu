"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function MainNav() {
  const pathname = usePathname();

  return (
    <div className="mr-4 hidden min-[576px]:flex items-center">
      <nav className="flex items-center gap-4 text-sm xl:gap-6">
        <Link
          href="/categories"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/categories"
              ? "text-foreground"
              : "text-foreground/80"
          )}
        >
          Categorias
        </Link>
        <Link
          href="/items"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/items" ? "text-foreground" : "text-foreground/80"
          )}
        >
          Items
        </Link>
        <Link
          href="/addons"
          className={cn(
            "transition-colors hover:text-foreground/80",
            pathname === "/addons" ? "text-foreground" : "text-foreground/80"
          )}
        >
          Adicionais
        </Link>
      </nav>
    </div>
  );
}
