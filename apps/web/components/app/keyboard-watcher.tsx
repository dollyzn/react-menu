"use client";

import { useEffect } from "react";

/**
 * Marks `<html data-keyboard>` while an on-screen keyboard leaves little room
 * on iOS, which keeps the page's height and shrinks only what is visible
 * (Android shrinks the page itself: `interactive-widget=resizes-content`).
 * The `tall:` variant (styles/globals.css) reads it, so drawer footers stop
 * covering the field being typed in on both.
 */
export function KeyboardWatcher() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const hidden = window.innerHeight - viewport.height;
      document.documentElement.toggleAttribute("data-keyboard", hidden > 120 && viewport.height < 560);
    };
    update();
    viewport.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.documentElement.removeAttribute("data-keyboard");
    };
  }, []);
  return null;
}
