import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ApiSuccess, Store } from "@react-menu/contracts";
import { serverApiBase, visitorHeaders } from "@/lib/server-api";
import { storeIconsMetadata } from "@/lib/store-icons";
import { StoreRealtime } from "./store-realtime";

/**
 * The panel of a store wears its logo: favicon, home-screen icon and the
 * install manifest (`?store=`). Read with the user's session; anything else
 * (signed out, no access) keeps the app's icons.
 */
export async function generateMetadata({ params }: { params: Promise<{ store: string }> }): Promise<Metadata> {
  try {
    const response = await fetch(`${serverApiBase()}stores/${(await params).store}`, {
      cache: "no-store",
      headers: { ...(await visitorHeaders()), cookie: (await cookies()).toString() },
    });
    if (!response.ok) return {};
    const store = ((await response.json()) as ApiSuccess<Store>).data;
    return {
      icons: storeIconsMetadata(store),
      manifest: `/app/manifest.webmanifest?store=${encodeURIComponent(store.slug)}`,
      appleWebApp: { capable: true, title: store.name, statusBarStyle: "default" },
    };
  } catch {
    return {};
  }
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreRealtime />
      {children}
    </>
  );
}
