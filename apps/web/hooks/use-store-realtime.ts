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

    // The menu as the panel sees it (availability, "Restam N") and the stock list.
    const menuTags = [
      { type: "Item" as const, id: "PUBLIC_MENU" },
      { type: "Ingredient" as const, id: `store-${storeId}` },
    ];
    // Back after a gap: anything missed is read again, the menu included.
    const refresh = () =>
      dispatch(
        baseApi.util.invalidateTags([
          { type: "Store", id: storeId },
          { type: "Order", id: `store-${storeId}` },
          { type: "Kitchen", id: storeId },
          ...menuTags,
        ])
      );

    const stopListening = subscription.onMessage<StoreEvent>((event) => {
      if (event.type === "store.status_changed") refresh();
      // Sold out by hand, a stock count, a recipe: what can be sold changed.
      else if (event.type === "stock.changed" || event.type === "menu.changed")
        dispatch(baseApi.util.invalidateTags(menuTags));
      else
        dispatch(
          baseApi.util.invalidateTags([
            { type: "Order", id: `store-${storeId}` },
            { type: "Kitchen", id: storeId },
            // Stock moves when an order is placed, gets items or is
            // cancelled; not on every kitchen tap, payment or hand-over.
            ...(event.type === "order.created" || event.status === "received" || event.status === "cancelled"
              ? menuTags
              : []),
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
