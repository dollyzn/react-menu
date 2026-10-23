import type { MetadataRoute } from "next";
import type { ApiSuccess, PublicStoreListing } from "@react-menu/contracts";
import { env } from "@/lib/env";
import { serverApiBase } from "@/lib/server-api";

// Stores come and go: build it per request (it's small and rarely crawled).
export const dynamic = "force-dynamic";

/** Every public menu ("/" for the default store) plus the legal pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, env.NEXT_PUBLIC_APP_URL).toString();
  const stores = await fetch(`${serverApiBase()}public/stores`, { cache: "no-store" })
    .then(async (response) => (response.ok ? ((await response.json()) as ApiSuccess<PublicStoreListing[]>).data : []))
    .catch(() => []);

  return [
    ...stores.map((store) => ({
      url: url(store.isDefault ? "/" : `/${store.slug}`),
      lastModified: store.updatedAt,
      changeFrequency: "daily" as const,
      priority: store.isDefault ? 1 : 0.9,
    })),
    ...(stores.some((store) => store.isDefault) ? [] : [{ url: url("/"), changeFrequency: "daily" as const, priority: 1 }]),
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
