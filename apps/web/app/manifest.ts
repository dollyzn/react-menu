import type { MetadataRoute } from "next";
import { fetchMenu } from "./(menu)/_lib/fetch-menu";
import { customerManifest } from "@/lib/pwa-manifest";

// Named after the store served at "/", so it reads well on a home screen.
export const dynamic = "force-dynamic";

/** Customer app of the default store: the menu, ordering and order tracking. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const store = await fetchMenu(undefined, { track: false })
    .then((menu) => menu?.store ?? null)
    .catch(() => null);
  return customerManifest(store);
}
