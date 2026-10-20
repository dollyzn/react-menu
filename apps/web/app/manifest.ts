import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fale Alto - CRM",
    short_name: "FaleAlto",
    description:
      "A Fale Alto é uma agência criativa que ao longo dos anos especializou-se no desenvolvimento de soluções publicitárias capazes de impulsionar a performance de pequenas e médias empresas.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
