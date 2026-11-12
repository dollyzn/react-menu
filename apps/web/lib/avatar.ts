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

