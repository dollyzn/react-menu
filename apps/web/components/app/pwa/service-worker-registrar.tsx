"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for every visitor (offline page, install,
 * push). Waits for `load` so it never competes with the first paint.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Installing and offline support are enhancements; the site works without them.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
