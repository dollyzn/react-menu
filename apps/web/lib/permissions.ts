import type { User } from "@/types/user";

/**
 * UI-only mirror of `User.can()` in the API, used to hide actions the
 * backend would reject. The API remains the source of truth.
 */
export function hasPermission(user: User | null | undefined, permission: string) {
  if (!user) return false;
  if (user.superUser) return true;
  return user.role?.permissions.some((p) => p.name === permission) ?? false;
}
