import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Menus and legal pages are public; the panel, orders and generated assets aren't for search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Store icons stay crawlable: search results show them next to the link.
        disallow: ["/app/", "/pedido/", "/pedidos", "/api/", "/*?*source=pwa"],
      },
    ],
    sitemap: new URL("/sitemap.xml", env.NEXT_PUBLIC_APP_URL).toString(),
    host: env.NEXT_PUBLIC_APP_URL,
  };
}
