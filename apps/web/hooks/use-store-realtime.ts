"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/api/baseApi";
import { getTransmit } from "@/lib/transmit";
import type { StoreEvent } from "@/types/realtime";

/**
 * Keeps the store's cached data fresh from server-sent events. Events are
 * hints to refetch, never data to trust on their own: anything missed while
 * disconnected is recovered by refetching on reconnect.
 */
export function useStoreRealtime(storeId: string) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const transmit = getTransmit();
    const subscription = transmit.subscription(`stores/${storeId}`);

    const refresh = () =>
      dispatch(
        baseApi.util.invalidateTags([
          { type: "Store", id: storeId },
          { type: "Order", id: `store-${storeId}` },
          { type: "Kitchen", id: storeId },
        ])
      );

    // Orders consume stock and stock counts change it: the menus open here
    // (the POS) read what is still available again, or a sold-out item stays
    // on sale until someone reloads.
    const menuTag = { type: "Item" as const, id: "PUBLIC_MENU" };
    const stopListening = subscription.onMessage<StoreEvent>((event) => {
      if (event.type === "store.status_changed") refresh();
      else if (event.type === "stock.changed")
        dispatch(baseApi.util.invalidateTags([menuTag, { type: "Ingredient", id: `store-${storeId}` }]));
      else
        dispatch(
          baseApi.util.invalidateTags([
            { type: "Order", id: `store-${storeId}` },
            { type: "Kitchen", id: storeId },
            menuTag,
          ])
        );
    });

    subscription.create().catch(() => {
      // Not authorized or offline: the page still works over plain HTTP.
    });

    let missedEvents = false;
    const onDisconnected = () => {
      missedEvents = true;
    };
    const onConnected = () => {
      if (!missedEvents) return;
      missedEvents = false;
      refresh();
    };

    transmit.on("disconnected", onDisconnected);
    transmit.on("connected", onConnected);
    // The event stream often doesn't notice a network drop (no "disconnected"),
    // so the board would wait for its 30 s poll: catch up as soon as the
    // device is back online.
    window.addEventListener("online", refresh);

    return () => {
      stopListening();
      transmit.off("disconnected", onDisconnected);
      transmit.off("connected", onConnected);
      window.removeEventListener("online", refresh);
      if (subscription.handlerCount === 0) void subscription.delete();
    };
  }, [storeId, dispatch]);
}
