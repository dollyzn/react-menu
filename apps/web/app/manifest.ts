import type { MetadataRoute } from "next";
import { fetchMenu } from "./(menu)/_lib/fetch-menu";
import { PWA_ICONS, PWA_THEME } from "@/lib/pwa-manifest";

// Named after the store served at "/", so it reads well on a home screen.
export const dynamic = "force-dynamic";

/** Customer app: the menu, ordering and order tracking (scope "/"). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const store = await fetchMenu()
    .then((menu) => menu?.store)
    .catch(() => null);
  const name = store?.name ?? "Cardápio";

  return {
    id: "/",
    name: store ? `${store.name} · Cardápio` : "React Menu · Cardápio",
    short_name: name.length > 12 ? "Cardápio" : name,
    description: store?.description || "Peça pelo celular e retire no balcão.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["food", "shopping"],
    ...PWA_THEME,
    icons: PWA_ICONS,
    screenshots: [
      {
        src: "/screenshots/menu-narrow.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "Cardápio com busca e categorias",
      },
      {
        src: "/screenshots/menu-wide.png",
        sizes: "2560x1440",
        type: "image/png",
        form_factor: "wide",
        label: "Cardápio no computador",
      },
    ],
  };
}
