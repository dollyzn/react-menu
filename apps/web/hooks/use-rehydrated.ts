import { useAppSelector } from "@/redux/hooks";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * True once the persisted Redux state (session, cart) has been restored AND
 * React finished hydrating. Persisted data must not change the first client
 * render: IndexedDB may finish before hydration, and the server never sees it.
 */
export function useRehydrated() {
  const hydrated = useHydrated();
  const rehydrated = useAppSelector(
    (state) => (state as { _persist?: { rehydrated: boolean } })._persist?.rehydrated ?? false
  );
  return hydrated && rehydrated;
}
