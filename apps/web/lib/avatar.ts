import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The user's photo, or a generated avatar (DiceBear "lorelei", seeded by the
 * name) for people who never uploaded one.
 */
export function avatarUrl(user: { avatarUrl?: string | null; name?: string | null; email: string }) {
  return user.avatarUrl || `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(user.name ?? user.email)}`;
}

/** "AS" for Ana Souza (shown while the image loads or if it fails). */
export function avatarInitials(user: { name?: string | null; email: string }) {
  const words = (user.name ?? user.email).trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words.at(-1)?.[0] ?? "") : (words[0]?.[1] ?? ""))).toUpperCase();
}

/**
 * Props for `AvatarFallback`: while an uploaded photo loads, its blurred
 * preview (the API's `avatarBlur`) fills the avatar; otherwise the initials.
 */
export function avatarPlaceholder(
  user: { avatarUrl?: string | null; avatarBlur?: string | null },
  initials: ReactNode,
  className?: string
): { style?: CSSProperties; className?: string; children: ReactNode } {
  if (!user.avatarUrl || !user.avatarBlur) return { className, children: initials };
  return {
    style: { backgroundImage: `url("${user.avatarBlur}")` },
    className: cn("bg-cover bg-center", className),
    children: null,
  };
}
