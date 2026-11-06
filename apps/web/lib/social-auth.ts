/** The social login popup reports to the login page on this channel (same origin). */
export const SOCIAL_AUTH_CHANNEL = "social-auth";
/** sessionStorage key: whether /app/social runs in a popup or as the whole page. */
export const SOCIAL_AUTH_MODE_KEY = "social-auth-mode";

export type SocialAuthMessage =
  | { type: "success" }
  | { type: "error"; error: string }
  /** Google was the first factor: the login page asks for the second step. */
  | { type: "two-factor" };

/** Installed app (PWA): popups open outside it, so the login uses the whole page. */
export function prefersFullPageLogin() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Room for Google's account chooser and consent screen without scrolling
 * (inner size; the browser adds its own bar). Shrinks to fit small screens.
 */
const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 760;

/** A centered popup for the provider's sign-in, or null when the browser blocks it. */
export function openSocialPopup(url: string) {
  const width = Math.min(POPUP_WIDTH, window.screen.availWidth - 40);
  const height = Math.min(POPUP_HEIGHT, window.screen.availHeight - 80);
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = Math.max(window.screenY + (window.outerHeight - height) / 2, 0);
  const popup = window.open(
    url,
    "social-login",
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`
  );
  // Some blockers hand back a window and close it at once.
  if (!popup || popup.closed) return null;
  popup.focus();
  return popup;
}
