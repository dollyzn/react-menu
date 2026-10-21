import type { StoreRole } from "@react-menu/contracts";
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
