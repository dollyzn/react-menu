import type { IngredientBadge as Badge, IngredientIconColor } from "@react-menu/contracts";
import { cn } from "@/lib/utils";

/** Tile (soft) and tag (strong) classes per color: literal, so Tailwind sees them. */
export const BADGE_COLORS: Record<IngredientIconColor, { name: string; tile: string; tag: string; swatch: string }> = {
  gray: { name: "Cinza", tile: "bg-zinc-200/70 dark:bg-zinc-500/25", tag: "bg-zinc-600 text-white", swatch: "bg-zinc-400" },
  red: { name: "Vermelho", tile: "bg-red-100 dark:bg-red-500/25", tag: "bg-red-600 text-white", swatch: "bg-red-500" },
  orange: { name: "Laranja", tile: "bg-orange-100 dark:bg-orange-500/25", tag: "bg-orange-600 text-white", swatch: "bg-orange-500" },
  amber: { name: "Âmbar", tile: "bg-amber-100 dark:bg-amber-500/25", tag: "bg-amber-700 text-white", swatch: "bg-amber-500" },
  yellow: { name: "Amarelo", tile: "bg-yellow-100 dark:bg-yellow-400/25", tag: "bg-yellow-400 text-yellow-950", swatch: "bg-yellow-400" },
  lime: { name: "Lima", tile: "bg-lime-100 dark:bg-lime-500/25", tag: "bg-lime-700 text-white", swatch: "bg-lime-500" },
  green: { name: "Verde", tile: "bg-green-100 dark:bg-green-500/25", tag: "bg-green-700 text-white", swatch: "bg-green-600" },
  teal: { name: "Verde-água", tile: "bg-teal-100 dark:bg-teal-500/25", tag: "bg-teal-700 text-white", swatch: "bg-teal-500" },
  sky: { name: "Azul-claro", tile: "bg-sky-100 dark:bg-sky-500/25", tag: "bg-sky-600 text-white", swatch: "bg-sky-400" },
  blue: { name: "Azul", tile: "bg-blue-100 dark:bg-blue-500/25", tag: "bg-blue-700 text-white", swatch: "bg-blue-600" },
  violet: { name: "Roxo", tile: "bg-violet-100 dark:bg-violet-500/25", tag: "bg-violet-700 text-white", swatch: "bg-violet-500" },
  pink: { name: "Rosa", tile: "bg-pink-100 dark:bg-pink-500/25", tag: "bg-pink-600 text-white", swatch: "bg-pink-500" },
};

const SIZES = {
  /** Inline, next to a name in a list. */
  xs: { tile: "size-6 rounded-md text-sm", tag: "-bottom-1 px-0.5 text-[7px]" },
  sm: { tile: "size-8 rounded-lg text-lg", tag: "-bottom-1.5 px-1 text-[8px]" },
  md: { tile: "size-10 rounded-xl text-2xl", tag: "-bottom-1.5 px-1 text-[9px]" },
  lg: { tile: "size-12 rounded-xl text-3xl", tag: "-bottom-2 px-1.5 text-[11px]" },
  xl: { tile: "size-16 rounded-2xl text-4xl", tag: "-bottom-2 px-1.5 text-xs" },
};

/**
 * An ingredient at a glance: emoji on its color, with the tag ("CAT") that
 * tells apart ingredients sharing the emoji. Decorative: the name is always
 * next to it (pass `label` when it isn't).
 */
export function IngredientBadge({
  badge,
  size = "sm",
  label,
  className,
}: {
  badge: Badge;
  size?: keyof typeof SIZES;
  /** Accessible name, for a badge shown without the ingredient's name. */
  label?: string;
  className?: string;
}) {
  const color = BADGE_COLORS[badge.color] ?? BADGE_COLORS.gray;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative flex shrink-0 items-center justify-center font-emoji", SIZES[size].tile, color.tile, className)}
    >
      {badge.emoji ?? <span className="size-1.5 rounded-full bg-current opacity-40" />}
      {badge.label && (
        <span
          className={cn(
            "absolute left-1/2 -translate-x-1/2 rounded-sm font-sans leading-tight font-bold tracking-wide shadow-sm ring-1 ring-background",
            SIZES[size].tag,
            color.tag
          )}
        >
          {badge.label}
        </span>
      )}
    </span>
  );
}
