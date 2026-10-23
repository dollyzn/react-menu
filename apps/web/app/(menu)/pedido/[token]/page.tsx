import type { Metadata } from "next";
import type { ApiSuccess, PublicOrder } from "@react-menu/contracts";
import { OrderTracking } from "../../_components/order-tracking";
import { serverApiBase, visitorHeaders } from "@/lib/server-api";
import { storeIconsMetadata } from "@/lib/store-icons";

type Props = { params: Promise<{ token: string }> };

/** The order's store on the tab and home screen (one call; the page itself loads on the client). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const fallback: Metadata = { title: "Acompanhe seu pedido", robots: { index: false, follow: false } };
  try {
    const response = await fetch(`${serverApiBase()}public/orders/${encodeURIComponent((await params).token)}`, {
      cache: "no-store",
      headers: await visitorHeaders(),
    });
    if (!response.ok) return fallback;
    const order = ((await response.json()) as ApiSuccess<PublicOrder>).data;
    return {
      ...fallback,
      title: `Pedido #${order.number} · ${order.store.name}`,
      icons: storeIconsMetadata(order.store),
      manifest: `/${order.store.slug}/manifest.webmanifest`,
      appleWebApp: { capable: true, title: order.store.name, statusBarStyle: "default" },
    };
  } catch {
    return fallback;
  }
}

export default async function OrderTrackingPage({ params }: Props) {
  return <OrderTracking token={(await params).token} />;
}
