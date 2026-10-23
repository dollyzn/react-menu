import "server-only";
import type { Metadata } from "next";
import type { PublicMenu } from "@react-menu/contracts";
import { storeMetadata } from "./store-metadata";

type MenuStore = PublicMenu["store"];

/** Where a store's menu lives: "/" for the default store, "/<slug>" for the others. */
export const menuPath = (store: Pick<MenuStore, "slug" | "isDefault">) =>
  store.isDefault ? "/" : `/${store.slug}`;

const MAX_DESCRIPTION = 160;

/**
 * ≈160 characters for search results and previews. The call to action
 * ("peça pelo celular e retire no balcão…") always fits; the item names go
 * in only if there's room, and the store's own text is what gets cut.
 */
export function storeDescription(store: MenuStore, menu?: PublicMenu) {
  const cta = `Peça pelo celular e retire no balcão${store.address ? `: ${store.address}` : ""}.`;
  const items = menu?.categories.flatMap((category) => category.items.map((item) => item.name)).slice(0, 4) ?? [];
  const highlight = items.length ? `${items.join(", ")} e mais.` : "";
  let about = store.description?.trim() ?? "";

  const join = (...parts: string[]) => parts.filter(Boolean).join(" ");
  if (join(about, highlight, cta).length <= MAX_DESCRIPTION) return join(about, highlight, cta);
  if (join(about, cta).length <= MAX_DESCRIPTION) return join(about, cta);
  const room = MAX_DESCRIPTION - cta.length - 2;
  about = room > 20 ? `${about.slice(0, room).trimEnd()}…` : "";
  return join(about, cta).slice(0, MAX_DESCRIPTION);
}

/**
 * Everything search engines and link previews read for a store's menu:
 * title, description, canonical (the default store's /<slug> points to
 * "/"), Open Graph and Twitter cards (the image comes from the segment's
 * opengraph-image), plus its icons and install manifest.
 */
export function storeSeoMetadata(menu: PublicMenu, manifestPath: string): Metadata {
  const { store } = menu;
  const title = `${store.name} · Cardápio`;
  const description = storeDescription(store, menu);
  const url = menuPath(store);
  return {
    title: { absolute: title },
    description,
    keywords: [store.name, "cardápio", "pedido online", "retirada no balcão", "delivery", "pastel"],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName: store.name,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
    ...storeMetadata(store, manifestPath),
  };
}
