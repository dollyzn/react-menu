import "server-only";
import type { Metadata } from "next";
import type { PublicMenu } from "@react-menu/contracts";
import { storeIconsMetadata } from "@/lib/store-icons";

/**
 * Head of a store's customer pages: its logo as favicon and home-screen
 * icon, its install manifest and name on iOS. `manifestPath` is
 * "/manifest.webmanifest" for the default store, "/<slug>/…" for others.
 */
export function storeMetadata(store: PublicMenu["store"], manifestPath: string): Metadata {
  return {
    icons: storeIconsMetadata(store),
    manifest: manifestPath,
    appleWebApp: { capable: true, title: store.name, statusBarStyle: "default" },
  };
}
