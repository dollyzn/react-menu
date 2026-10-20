import type { StoreRole } from "@react-menu/contracts";
import { useAppSelector } from "@/redux/hooks";

/** The signed-in user's role in a store (UI only; the API enforces it). */
export function useStoreRole(storeId: string): StoreRole | null {
  return useAppSelector(
    (state) => state.auth.user?.stores.find((store) => store.id === storeId)?.role ?? null
  );
}
