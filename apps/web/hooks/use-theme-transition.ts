"use client";

import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "@wrksz/themes/client";

export type ThemeChoice = "system" | "light" | "dark";

const systemResolved = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/**
 * Theme changes with a circular reveal from where the user clicked (View
 * Transitions API). Falls back to an instant change without the API or with
 * reduced motion. Also updates `data-theme-choice`, which the server-rendered
 * theme icons read before hydration.
 */
export function useThemeTransition() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const change = useCallback(
    (next: ThemeChoice, origin?: { x: number; y: number }) => {
      const resolved = next === "system" ? systemResolved() : next;
      const apply = () => {
        document.documentElement.dataset.themeChoice = next;
        setTheme(next);
      };

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (resolved === resolvedTheme || !document.startViewTransition || reduced) {
        apply();
        return;
      }

      const x = origin?.x ?? window.innerWidth;
      const y = origin?.y ?? 0;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

      const transition = document.startViewTransition(() => {
        flushSync(() => {
          document.documentElement.classList.toggle("dark", resolved === "dark");
          apply();
        });
      });
      void transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 550, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
        );
      });
    },
    [resolvedTheme, setTheme]
  );

  /** Origin for `change` from a click (center of the clicked element). */
  const originOf = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  return { choice: (theme ?? "system") as ThemeChoice, resolvedTheme, change, originOf };
}
