"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  ThemeTogglerButton,
  type ThemeTogglerButtonProps,
} from "@/components/animate-ui/components/buttons/theme-toggler";
import { buttonVariants } from "@/components/animate-ui/components/buttons/icon";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

/**
 * The animate-ui theme toggle, safe on server-rendered pages. Until hydration
 * it renders the same button with all three icons; CSS shows the saved choice
 * from `data-theme-choice`, which the inline script in the root layout sets
 * before the first paint. So the right icon is there on F5, with no flash.
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
      <button
        type="button"
        aria-label="Alternar tema"
        className={cn(buttonVariants({ variant, size, className }))}
      >
        <Sun className="hidden [[data-theme-choice=light]_&]:block" />
        <Moon className="hidden [[data-theme-choice=dark]_&]:block" />
        <Monitor className="hidden [[data-theme-choice=system]_&]:block [html:not([data-theme-choice])_&]:block" />
      </button>
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
