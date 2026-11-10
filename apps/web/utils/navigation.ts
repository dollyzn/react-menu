import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { requestLogout } from "@/lib/logout-intent";

/**
 * To the login with a full page load: the router's cache still holds the
 * signed-in pages, and a sign-in right after would reuse what it fetched
 * signed out (see `enterPanel`).
 */
export function redirectToLogin() {
  window.location.assign(new URL("/app/login", window.location.origin));
}

/** The panel's own sign-out: the logout page signs out without asking. */
export function redirectToLogout(router: AppRouterInstance) {
  requestLogout();
  router.push("/app/logout");
}
