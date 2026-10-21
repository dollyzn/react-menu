/** The social login popup reports to the login page on this channel (same origin). */
export const SOCIAL_AUTH_CHANNEL = "social-auth";
/** sessionStorage key: whether /app/social runs in a popup or as the whole page. */
export const SOCIAL_AUTH_MODE_KEY = "social-auth-mode";

export type SocialAuthMessage = { type: "success" } | { type: "error"; error: string };

/** Installed app (PWA): popups open outside it, so the login uses the whole page. */
export function prefersFullPageLogin() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** A centered popup for the provider's sign-in, or null when the browser blocks it. */
export function openSocialPopup(url: string) {
  const width = 500;
  const height = 640;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const popup = window.open(
    url,
    "social-login",
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`
  );
  popup?.focus();
  return popup;
}
