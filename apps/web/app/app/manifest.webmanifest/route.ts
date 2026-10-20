import type { MetadataRoute } from "next";
import { PWA_ICONS, PWA_THEME } from "@/lib/pwa-manifest";

/**
 * Staff app (scope "/app/"): installs separately from the customer menu and
 * opens straight into the panel, full screen on POS and kitchen tablets.
 */
const manifest: MetadataRoute.Manifest = {
  id: "/app/",
  name: "React Menu · Painel",
  short_name: "Painel",
  description: "Pedidos, PDV, cozinha e estoque da loja.",
  start_url: "/app/stores?source=pwa",
  scope: "/app/",
  display: "standalone",
  orientation: "any",
  lang: "pt-BR",
  dir: "ltr",
  categories: ["business", "food", "productivity"],
  ...PWA_THEME,
  icons: PWA_ICONS,
  screenshots: [
    {
      src: "/screenshots/staff-wide.png",
      sizes: "2560x1440",
      type: "image/png",
      form_factor: "wide",
      label: "PDV: monte o pedido e envie para a cozinha",
    },
    {
      src: "/screenshots/staff-narrow.png",
      sizes: "780x1688",
      type: "image/png",
      form_factor: "narrow",
      label: "Quadro de pedidos no celular",
    },
  ],
};

export function GET() {
  return Response.json(manifest, {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" },
  });
}
