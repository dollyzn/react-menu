"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppDispatch } from "@/redux/hooks";
import { baseApi } from "@/redux/api/baseApi";
import { getTransmit } from "@/lib/transmit";
import type { UserEvent } from "@/types/notification";

/**
 * Listens to the signed-in user's notification channel: refreshes the list
 * and shows a toast for each new notification. Like every realtime event,
 * it only triggers a refetch; missed events are recovered on reconnect.
 */
export function useNotificationsRealtime(userId: string | undefined) {
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    const transmit = getTransmit();
    const subscription = transmit.subscription(`users/${userId}/notifications`);

    const refresh = () =>
      dispatch(
        baseApi.util.invalidateTags([{ type: "Notification", id: "LIST" }])
      );

    const stopListening = subscription.onMessage<UserEvent>((event) => {
      if (event.type !== "notification.created") return;
      refresh();

      const { title, body, url } = event.notification;
      toast(title, {
        description: body,
        action: url
          ? { label: "Ver", onClick: () => router.push(url) }
          : undefined,
      });
    });

    subscription.create().catch(() => {
      // Offline or not authorized: the popover still loads over HTTP.
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
  }, [userId, dispatch, router]);
}
