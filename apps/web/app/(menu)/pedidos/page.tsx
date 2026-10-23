import { Suspense } from "react";
import type { Metadata } from "next";
import { OrderHistory } from "../_components/order-history";
import { fetchMenu } from "../_lib/fetch-menu";
import { storeMetadata } from "../_lib/store-metadata";

/** The default store's icons (the history spans the device's orders); private, not indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = { title: "Meus pedidos", robots: { index: false, follow: false } };
  const store = await fetchMenu(undefined, { track: false })
    .then((menu) => menu?.store ?? null)
    .catch(() => null);
  return store ? { ...base, ...storeMetadata(store, "/manifest.webmanifest") } : base;
}

/** The customer's orders on this device (and linked devices). */
export default function OrderHistoryPage() {
  // useSearchParams (?vincular=) needs a Suspense boundary on a static page.
  return (
    <Suspense>
      <OrderHistory />
    </Suspense>
  );
}
