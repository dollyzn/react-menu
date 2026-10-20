"use client";

import {
  ThemeTogglerButton,
  type ThemeTogglerButtonProps,
} from "@/components/animate-ui/components/buttons/theme-toggler";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

const placeholderSize = { default: "size-9", xs: "size-7", sm: "size-8", lg: "size-10" } as const;

/**
 * The animate-ui theme toggle, safe on server-rendered pages: its icon depends
 * on the client theme, so a same-size placeholder renders until hydration.
 * Use this instead of ThemeTogglerButton.
 */
export function ThemeToggleButton({
  variant = "ghost",
  size = "default",
  className,
}: Pick<ThemeTogglerButtonProps, "variant" | "size" | "className">) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <span
        aria-hidden
        className={cn("inline-block", placeholderSize[size ?? "default"], className)}
      />
    );
  }

  return (
    <ThemeTogglerButton
      variant={variant}
      size={size}
      direction="tr-circle"
      aria-label="Alternar tema"
      className={className}
    />
  );
}
