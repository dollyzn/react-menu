"use client";

import { useMemo, useState } from "react";
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

export function MenuView({ menu }: { menu: PublicMenu }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PublicMenuItem | null>(null);

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
      <MenuTopBar storeName={menu.store.name} query={query} onQueryChange={setQuery} />

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

        {!menu.store.isOpen && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            <StoreIcon className="size-5 shrink-0" />
            Estamos fechados agora. Você pode olhar o cardápio, e os pedidos voltam quando abrirmos.
          </div>
        )}

        <div className="mt-4">
          <CategoryNav categories={categories} />
        </div>

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
      </main>

      <ItemDetail
        item={selected}
        storeSlug={menu.store.slug}
        storeOpen={menu.store.isOpen}
        onClose={() => setSelected(null)}
      />
      <Cart store={menu.store} />
    </div>
  );
}
