/**
 * Where to go after signing in: the panel page a link pointed to (an e-mail
 * notification, a shared link). The route guard sends `?next=<path>` to the
 * login (`?next=<path>`); it is kept for the tab so the Google sign-in, which leaves the page,
 * comes back to it too. Only panel paths are accepted (no open redirect).
 */
export const RETURN_PARAM = "next";
const STORAGE_KEY = "react-menu:next";
const DEFAULT = "/app/stores";
/**
 * Pages that are no destination: going back to /app/logout after signing in
 * would sign out again (a loop), and the others are the sign-in itself.
 */
const AUTH_PAGES = ["/app/login", "/app/logout", "/app/social", "/app/esqueci-minha-senha", "/app/redefinir-senha"];

export function safeReturnPath(raw: string | null | undefined) {
  if (!raw) return null;
  // Same-origin panel paths only: "/app/…", never "//host" or "/app/login".
  if (!raw.startsWith("/app/") || raw.startsWith("//") || raw.includes("\\")) return null;
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "");
  if (AUTH_PAGES.includes(path)) return null;
  return raw;
}

/** The login page keeps the target for the tab (the Google sign-in leaves the page). */
export function rememberReturnPath() {
  const target = safeReturnPath(new URLSearchParams(window.location.search).get(RETURN_PARAM));
  try {
    if (target) sessionStorage.setItem(STORAGE_KEY, target);
  } catch {
    // Storage blocked: the URL still carries it.
  }
}

/** Signing out: a target kept for the tab is not for the next person. */
export function forgetReturnPath() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked.
  }
}

/** Where to land after signing in (and forget it). */
export function takeReturnPath() {
  const fromUrl = safeReturnPath(new URLSearchParams(window.location.search).get(RETURN_PARAM));
  let stored: string | null = null;
  try {
    stored = safeReturnPath(sessionStorage.getItem(STORAGE_KEY));
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked.
  }
  return fromUrl ?? stored ?? DEFAULT;
}
