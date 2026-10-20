"use client";

import { useParams } from "next/navigation";
import { useStoreRealtime } from "@/hooks/use-store-realtime";

/** Keeps every screen of the store live (status, orders, kitchen queue). */
export function StoreRealtime() {
  const { store } = useParams<{ store: string }>();
  useStoreRealtime(store);
  return null;
}
