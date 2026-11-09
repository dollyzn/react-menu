/**
 * The panel's own "Sair" (menu, settings, expired session) marks the request
 * in this page's memory before going to /app/logout. A link from another site
 * can't: with the session cookie SameSite=Lax it would open the logout page
 * signed in, and the page asks first instead of signing out (ADR 0019).
 */
let requested = false;

export function requestLogout() {
  requested = true;
}

/** Whether the panel asked for it (kept until the sign-out ends). */
export function logoutRequested() {
  return requested;
}

export function clearLogoutRequest() {
  requested = false;
}
