import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "React Menu",
    short_name: "Cardápio",
    description:
      "Cardápio digital e pedidos para restaurantes: pedido pelo celular, retirada no balcão, PDV e tela da cozinha.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c2410c",
    icons: [{ src: "/logo.png", sizes: "any", type: "image/png" }],
  };
}
