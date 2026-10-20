import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function redirectToLogin(router: AppRouterInstance) {
  router.push("/app/login");
}

export function redirectToLogout(router: AppRouterInstance) {
  router.push("/app/logout");
}
