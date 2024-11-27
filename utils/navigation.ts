import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function redirectToLogin(router: AppRouterInstance) {
  router.push("/auth/login");
}
