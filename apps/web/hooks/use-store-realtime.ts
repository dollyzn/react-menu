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
      dispatch(baseApi.util.invalidateTags([{ type: "Store", id: storeId }]));

    const stopListening = subscription.onMessage<StoreEvent>((event) => {
      if (event.type === "store.status_changed") refresh();
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

    return () => {
      stopListening();
      transmit.off("disconnected", onDisconnected);
      transmit.off("connected", onConnected);
      if (subscription.handlerCount === 0) void subscription.delete();
    };
  }, [storeId, dispatch]);
}
