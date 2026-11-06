"use client";

import { useEffect } from "react";
import { useLazyPresenceQuery } from "@/redux/features/auth/authApi";

/** A bit under the API's online window (2.5 min), so one late ping doesn't read as offline. */
const EVERY_MS = 60_000;

/**
 * Tells the API the panel is open ("online" on the team page): a ping when
 * it opens, a minute while the tab is visible, and when it becomes visible again.
 * Hidden tabs stop pinging, so people show as offline a couple of minutes
 * after they leave.
 */
export function PresenceHeartbeat() {
  const [ping] = useLazyPresenceQuery();

  useEffect(() => {
    const visible = () => document.visibilityState === "visible";
    const beat = () => {
      if (visible()) void ping();
    };
    // Right away too: pages that poll in the background don't count.
    beat();
    const timer = window.setInterval(beat, EVERY_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [ping]);

  return null;
}
