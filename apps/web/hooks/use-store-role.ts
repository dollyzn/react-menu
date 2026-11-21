import type { PartnerMemberRole, StoreRole } from "@react-menu/contracts";
import { useAppSelector } from "@/redux/hooks";

/**
 * The signed-in user's role in a store (UI only; the API enforces it).
 * Super admins act as managers everywhere, as in the API (User.roleIn).
 */
export function useStoreRole(storeId: string): StoreRole | null {
  return useAppSelector((state) => {
    const user = state.auth.user;
    if (!user) return null;
    if (user.superUser) return "manager";
    return user.stores.find((store) => store.id === storeId)?.role ?? null;
  });
}

/**
 * Inside a partner (ADR 0024), the person's role: its manager sees the
 * commission, an attendant only sells (UI only; the API enforces it).
 */
export function usePartnerRole(storeId: string): PartnerMemberRole | null {
  return useAppSelector((state) => {
    const store = state.auth.user?.stores.find((candidate) => candidate.id === storeId);
    return store?.role === "partner" ? (store.partnerRole ?? "attendant") : null;
  });
}
