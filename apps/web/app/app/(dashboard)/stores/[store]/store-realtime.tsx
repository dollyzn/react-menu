"use client";

import { useParams } from "next/navigation";
import { useStoreRealtime } from "@/hooks/use-store-realtime";
import { usePartnerRealtime } from "@/hooks/use-partner-realtime";
import { useStoreRole } from "@/hooks/use-store-role";
import { useGetPartnerContextQuery } from "@/redux/features/partner/partnerAreaApi";

/** Keeps every screen of the store live (status, orders, kitchen queue). */
export function StoreRealtime() {
  const { store } = useParams<{ store: string }>();
  const role = useStoreRole(store);
  // Until the session says who it is: a partner must not ask for the store's channel.
  if (!role) return null;
  if (role === "partner") return <PartnerRealtime storeId={store} />;
  return <StaffRealtime storeId={store} />;
}

function StaffRealtime({ storeId }: { storeId: string }) {
  useStoreRealtime(storeId);
  return null;
}

/** Partners follow only their own channel (ADR 0024). */
function PartnerRealtime({ storeId }: { storeId: string }) {
  const { data: context } = useGetPartnerContextQuery(storeId);
  usePartnerRealtime(storeId, context?.partner.id);
  return null;
}
