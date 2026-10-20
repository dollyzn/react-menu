import type { Metadata } from "next";
import { OrderTracking } from "../../_components/order-tracking";

export const metadata: Metadata = { title: "Acompanhe seu pedido" };

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <OrderTracking token={(await params).token} />;
}
