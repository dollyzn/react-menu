"use client";

import { useUpdateStoreMutation } from "@/redux/features/store/storeApi";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setUser } from "@/redux/slices/auth";

/**
 * Saves part of the store (`PUT /stores/:id`) and keeps the session's copy
 * in step: the sidebar's store switcher and the breadcrumbs read the name
 * and the slug from there.
 */
export function useSaveStore() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [update, state] = useUpdateStoreMutation();

  const save = async (id: string, data: Partial<Store>) => {
    const saved = await update({ id, data }).unwrap();
    if (user) {
      dispatch(
        setUser({ ...user, stores: user.stores.map((store) => (store.id === saved.id ? { ...store, ...saved } : store)) })
      );
    }
    return saved;
  };

  return [save, state] as const;
}
