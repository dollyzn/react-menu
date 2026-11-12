"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarInitials, avatarUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type LoadingStatus = "idle" | "loading" | "loaded" | "error";

/**
 * An avatar with a photo: while it loads, its blurred preview (the API's
 * `avatarBlur` / `photoBlur`) fills it; if it fails, the fallback (initials)
 * shows, never the blur for good.
 */
export function PhotoAvatar({
  src,
  blur,
  alt = "",
  fallback,
  className,
  imageClassName,
  fallbackClassName,
  fit = "cover",
}: {
  src?: string | null;
  blur?: string | null;
  alt?: string;
  fallback: ReactNode;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  /** "contain" for logos drawn whole (with padding): the preview takes the same shape. */
  fit?: "cover" | "contain";
}) {
  const [status, setStatus] = useState<LoadingStatus>("idle");
  const showBlur = Boolean(src && blur) && status !== "error";
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={alt} className={imageClassName} onLoadingStatusChange={setStatus} />}
      <AvatarFallback className={cn(fallbackClassName, showBlur && "relative overflow-hidden")}>
        {showBlur ? (
          // Blurred and slightly enlarged, like next/image's placeholder (a 12px image scaled up).
          <span
            aria-hidden
            className={cn(
              "absolute bg-center",
              fit === "cover" ? "inset-0 scale-125 bg-cover blur-[6px]" : "inset-0.5 bg-contain bg-no-repeat blur-[3px]"
            )}
            style={{ backgroundImage: `url("${blur}")` }}
          />
        ) : (
          fallback
        )}
      </AvatarFallback>
    </Avatar>
  );
}

/** A user's avatar: their uploaded photo (blurred while it loads) or a generated one, then the initials. */
export function UserAvatar({
  user,
  className,
  fallbackClassName,
}: {
  user: { avatarUrl?: string | null; avatarBlur?: string | null; name?: string | null; email: string };
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <PhotoAvatar
      src={avatarUrl(user)}
      blur={user.avatarUrl ? user.avatarBlur : null}
      fallback={avatarInitials(user)}
      className={className}
      fallbackClassName={fallbackClassName}
    />
  );
}
