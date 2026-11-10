import store from "@/redux/store";
import { homeForRole } from "@/lib/menu-itens";
import { DEFAULT_RETURN_PATH, takeReturnPath } from "@/lib/return-to";

/**
 * Into the panel after signing in: a full page load, not a client
 * navigation. The router keeps what it fetched while signed out (the route
 * guard's redirect of a panel page to the login, the login page itself) and
 * would show the login again until a reload.
 *
 * Without a target from a link, straight to the user's first store (signing
 * in loaded the user): loading the store list first would leave its generic
 * install manifest in the page next to the store's.
 */
export function enterPanel({ replace = false }: { replace?: boolean } = {}) {
  let target = takeReturnPath();
  const first = store.getState().auth.user?.stores[0];
  if (target === DEFAULT_RETURN_PATH && first) target = homeForRole(first.id, first.role);
  if (replace) window.location.replace(target);
  else window.location.assign(target);
}
