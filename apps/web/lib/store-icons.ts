import type { Metadata, MetadataRoute } from "next";

/** Icons generated from a store's logo by app/icons/store/[slug]/[file]/route.ts. */
export const STORE_ICON_FILES = {
  "favicon-32.png": { size: 32, shape: "rounded" },
  "apple-touch-icon.png": { size: 180, shape: "square" },
  "icon-192.png": { size: 192, shape: "rounded" },
  "icon-512.png": { size: 512, shape: "rounded" },
  "icon-maskable-512.png": { size: 512, shape: "maskable" },
} as const;

export type StoreIconFile = keyof typeof STORE_ICON_FILES;

type StoreLike = { slug: string; photoUrl: string | null };

/** Changes with the logo, so browsers fetch the new icons right away. */
function version(photoUrl: string | null) {
  let hash = 5381;
  for (const char of photoUrl ?? "none") hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

export function storeIconUrl(store: StoreLike, file: StoreIconFile) {
  return `/icons/store/${encodeURIComponent(store.slug)}/${file}?v=${version(store.photoUrl)}`;
}

/** Favicon and home-screen icon of a store's pages (menu or panel). */
export function storeIconsMetadata(store: StoreLike): Metadata["icons"] {
  return {
    icon: [
      { url: storeIconUrl(store, "favicon-32.png"), sizes: "32x32", type: "image/png" },
      { url: storeIconUrl(store, "icon-192.png"), sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: storeIconUrl(store, "apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
  };
}

export function storeManifestIcons(store: StoreLike): MetadataRoute.Manifest["icons"] {
  return [
    { src: storeIconUrl(store, "icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: storeIconUrl(store, "icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
    { src: storeIconUrl(store, "icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
}
