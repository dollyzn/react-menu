"use client";

import { useEffect } from "react";
import { useTheme } from "@wrksz/themes/client";
import { THEME_COLORS } from "@/lib/theme-colors";

/**
 * The phone browser paints its bars (Android's navigation bar, the address
 * bar) with `theme-color`. The metadata picks it by the system's light/dark;
 * this follows the theme chosen on the site instead, so the bars blend with
 * the page (a dark page on a phone in light mode got a bright bar).
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const color = THEME_COLORS[resolvedTheme];
    // Every meta (one per system scheme) gets the site's color, so whichever
    // the browser picks says the same.
    const apply = () =>
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
        if (meta.content !== color) meta.content = color;
      });
    apply();
    // Next writes the metadata's tags again after hydration: keep ours.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });
    return () => observer.disconnect();
  }, [resolvedTheme]);

  return null;
}
