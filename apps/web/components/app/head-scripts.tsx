"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

const SCRIPT = [
  // Keep the install prompt if it fires before React hydrates
  // (see hooks/use-pwa-install.ts).
  "window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;});",
  // Saved theme choice for the theme button's icon before hydration
  // (@wrksz/themes applies the class itself).
  "try{document.documentElement.dataset.themeChoice=localStorage.getItem('theme')||'system';}catch(_){}",
].join("");

/**
 * Inline scripts that must run before hydration. Injected into the server
 * HTML only (useServerInsertedHTML), so React never creates a <script> on the
 * client, which it warns about and would not run anyway.
 */
export function HeadScripts() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
  });
  return null;
}
