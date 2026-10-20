"use client";

import { Search, X } from "lucide-react";
import { ThemeToggleButton } from "@/components/app/theme-toggle-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecentOrdersButton } from "./recent-orders";

interface MenuTopBarProps {
  storeName: string;
  query: string;
  onQueryChange: (query: string) => void;
}

export function MenuTopBar({ storeName, query, onQueryChange }: MenuTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            inputMode="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={`Buscar em ${storeName}`}
            aria-label="Buscar no cardápio"
            className="h-9 rounded-full bg-muted/60 pr-9 pl-9"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Limpar busca"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full"
              onClick={() => onQueryChange("")}
            >
              <X />
            </Button>
          )}
        </div>
        <RecentOrdersButton />
        <ThemeToggleButton className="rounded-full" />
      </div>
    </header>
  );
}
