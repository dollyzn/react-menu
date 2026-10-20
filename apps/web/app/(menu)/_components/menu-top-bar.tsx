"use client";

import { SearchInput } from "@/components/app/search-input";
import { ThemeToggleButton } from "@/components/app/theme-toggle-button";
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
        <SearchInput
          value={query}
          onValueChange={onQueryChange}
          placeholder={`Buscar em ${storeName}`}
          aria-label="Buscar no cardápio"
          wrapperClassName="flex-1"
          className="h-9 rounded-full bg-muted/60"
        />
        <RecentOrdersButton />
        <ThemeToggleButton className="rounded-full" />
      </div>
    </header>
  );
}
