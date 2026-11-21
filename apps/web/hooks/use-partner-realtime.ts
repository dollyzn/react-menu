"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/api/baseApi";
import { getTransmit } from "@/lib/transmit";
import type { PartnerEvent } from "@/types/realtime";

/**
 * The partner area live (ADR 0024): `stores/:id/partners/:partnerId` says
 * the partner's orders or commission changed; the screens read them again.
 * The store's own channel isn't theirs. Missed events are read again after
 * reconnecting or when the device is back online.
 */
export function usePartnerRealtime(storeId: string, partnerId: string | undefined) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!partnerId) return;
    const transmit = getTransmit();
    const subscription = transmit.subscription(`stores/${storeId}/partners/${partnerId}`);
    const tags = (event?: PartnerEvent) =>
      [
        { type: "Partner" as const, id: `orders-${storeId}` },
        { type: "Partner" as const, id: `commission-${storeId}` },
        { type: "PointConfig" as const, id: `charges-partner-${storeId}` },
        // Rules, pause, catalog: the context and the menu.
        ...(!event || event.type === "partner.commission.changed"
          ? [
              { type: "Partner" as const, id: `context-${storeId}` },
              { type: "Partner" as const, id: `menu-${storeId}` },
            ]
          : []),
      ];
    const refresh = () => dispatch(baseApi.util.invalidateTags(tags()));

    const stopListening = subscription.onMessage<PartnerEvent>((event) => {
      dispatch(baseApi.util.invalidateTags(tags(event)));
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
    window.addEventListener("online", refresh);

    return () => {
      stopListening();
      transmit.off("disconnected", onDisconnected);
      transmit.off("connected", onConnected);
      window.removeEventListener("online", refresh);
      if (subscription.handlerCount === 0) void subscription.delete();
    };
  }, [storeId, partnerId, dispatch]);
}
