"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { SearchX, Store as StoreIcon } from "lucide-react";
import type { PublicMenu, PublicMenuItem } from "@react-menu/contracts";
import { normalizeSearch } from "@/utils/string";
import { MenuTopBar } from "./menu-top-bar";
import { StoreHero } from "./store-hero";
import { CategoryNav, categoryAnchor } from "./category-nav";
import { MenuItemCard } from "./menu-item-card";
import { ItemDetail } from "./item-detail";
import { Cart } from "./cart";
import { InstallAppCard } from "@/components/app/pwa/install-app";
import { countVisit } from "@/lib/install-prompt-storage";
import { useAppSelector } from "@/redux/hooks";

export function MenuView({ menu }: { menu: PublicMenu }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PublicMenuItem | null>(null);
  // Invite to install only customers who came back or already ordered. Only
  // read on the client; the invitation never renders during SSR/hydration.
  const [visits] = useState(() => (typeof window === "undefined" ? 0 : countVisit()));
  const hasOrdered = useAppSelector((state) => state.customer.recentOrders.length > 0);
  const stock = useMemo(
    () =>
      Object.fromEntries(
        menu.categories.flatMap((category) => category.items.map((item) => [item.id, item.stockLeft]))
      ),
    [menu]
  );

  // Results start at the top of the list; don't leave the customer halfway
  // down a filtered page.
  const search = (value: string) => {
    setQuery(value);
    window.scrollTo({ top: 0 });
  };

  const categories = useMemo(() => {
    const term = normalizeSearch(query);
    if (!term) return menu.categories;
    return menu.categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          normalizeSearch(`${item.name} ${item.description ?? ""} ${category.name}`).includes(term)
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu.categories, query]);

  return (
    <div className="min-h-svh bg-background">
      <MenuTopBar storeName={menu.store.name} storeSlug={menu.store.slug} query={query} onQueryChange={search} />

      <main className="mx-auto max-w-3xl px-4 pb-36">
        <AnimatePresence initial={false}>
          {!query && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <StoreHero store={menu.store} />
            </motion.div>
          )}
        </AnimatePresence>

        {!query && (
          <InstallAppCard
            context="menu"
            when={visits >= 2 || hasOrdered}
            title="Peça mais rápido pelo app"
            description={`Instale o cardápio da ${menu.store.name}: abre em um toque e seus pedidos ficam à mão.`}
            className="mt-4"
          />
        )}

        {!menu.store.isOpen && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            <StoreIcon className="size-5 shrink-0" />
            Estamos fechados agora. Você pode olhar o cardápio, e os pedidos voltam quando abrirmos.
          </div>
        )}

        {/* Direct child of <main>: a wrapper would stop it from sticking. */}
        <CategoryNav categories={categories} className="mt-4" />

        {categories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <SearchX className="size-10" />
            <p className="font-medium text-foreground">Nada encontrado para “{query}”</p>
            <p className="text-sm">Tente outro nome ou ingrediente.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-10">
            {categories.map((category) => (
              <section
                key={category.id}
                id={categoryAnchor(category.id)}
                data-category={category.id}
                aria-labelledby={`${categoryAnchor(category.id)}-title`}
                className="scroll-mt-32"
              >
                <h2 id={`${categoryAnchor(category.id)}-title`} className="text-xl font-bold">
                  {category.name}
                </h2>
                {category.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {category.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-16 flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacidade
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Termos de uso
          </Link>
        </footer>
      </main>

      <ItemDetail
        item={selected}
        storeSlug={menu.store.slug}
        storeOpen={menu.store.isOpen}
        onClose={() => setSelected(null)}
      />
      <Cart store={menu.store} stock={stock} />
    </div>
  );
}
