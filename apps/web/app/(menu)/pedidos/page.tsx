import { Suspense } from "react";
import type { Metadata } from "next";
import { OrderHistory } from "../_components/order-history";

export const metadata: Metadata = { title: "Meus pedidos" };

/** The customer's orders on this device (and linked devices). */
export default function OrderHistoryPage() {
  // useSearchParams (?vincular=) needs a Suspense boundary on a static page.
  return (
    <Suspense>
      <OrderHistory />
    </Suspense>
  );
}
