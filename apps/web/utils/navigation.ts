import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { requestLogout } from "@/lib/logout-intent";

export function redirectToLogin(router: AppRouterInstance) {
  router.push("/app/login");
}

/** The panel's own sign-out: the logout page signs out without asking. */
export function redirectToLogout(router: AppRouterInstance) {
  requestLogout();
  router.push("/app/logout");
}
