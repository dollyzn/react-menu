"use client";

import * as React from "react";
import { flushSync } from "react-dom";

type ThemeSelection = "light" | "dark" | "system";
type Resolved = "light" | "dark";
type Direction = "btt" | "ttb" | "ltr" | "rtl" | "tr-circle";

type ChildrenRender =
  | React.ReactNode
  | ((state: {
      resolved: Resolved;
      effective: ThemeSelection;
      toggleTheme: (theme: ThemeSelection) => void;
    }) => React.ReactNode);

function getSystemEffective(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getClipKeyframes(direction: Direction): [string, string] {
  switch (direction) {
    case "ltr":
      return ["inset(0 100% 0 0)", "inset(0 0 0 0)"];
    case "rtl":
      return ["inset(0 0 0 100%)", "inset(0 0 0 0)"];
    case "ttb":
      return ["inset(0 0 100% 0)", "inset(0 0 0 0)"];
    case "btt":
      return ["inset(100% 0 0 0)", "inset(0 0 0 0)"];
    case "tr-circle":
      return ["circle(0% at 100% 0%)", "circle(150% at 100% 0%)"];
    default:
      return ["inset(0 100% 0 0)", "inset(0 0 0 0)"];
  }
}

type ThemeTogglerProps = {
  theme: ThemeSelection;
  resolvedTheme: Resolved;
  setTheme: (theme: ThemeSelection) => void;
  direction?: Direction;
  onImmediateChange?: (theme: ThemeSelection) => void;
  children?: ChildrenRender;
};

function ThemeToggler({
  theme,
  resolvedTheme,
  setTheme,
  onImmediateChange,
  direction = "ltr",
  children,
  ...props
}: ThemeTogglerProps) {
  const [preview, setPreview] = React.useState<null | {
    effective: ThemeSelection;
    resolved: Resolved;
  }>(null);

  const [fromClip, toClip] = getClipKeyframes(direction);

  const toggleTheme = React.useCallback(
    async (theme: ThemeSelection) => {
      const resolved = theme === "system" ? getSystemEffective() : theme;
      onImmediateChange?.(theme);

      if (theme === "system" && resolved === resolvedTheme) {
        setPreview(null);
        setTheme(theme);
        return;
      }

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!document.startViewTransition || reduced) {
        setTheme(theme);
        return;
      }

      // The theme is set *inside* the transition: @wrksz/themes watches the
      // <html> class and puts its stored theme back on the next frame, so a
      // class toggled by hand (theme set only after the animation) was undone
      // before the new snapshot, e.g. from "system" (dark) to light.
      await document.startViewTransition(() => {
        flushSync(() => {
          setPreview({ effective: theme, resolved });
          document.documentElement.classList.toggle("dark", resolved === "dark");
          document.documentElement.style.colorScheme = resolved;
          setTheme(theme);
        });
      }).ready;

      document.documentElement
        .animate(
          { clipPath: [fromClip, toClip] },
          {
            duration: 700,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        )
        .finished.finally(() => setPreview(null));
    },
    [onImmediateChange, resolvedTheme, fromClip, toClip, setTheme]
  );

  const effective = preview?.effective ?? theme;
  const resolved = preview?.resolved ?? resolvedTheme;

  return (
    <React.Fragment {...props}>
      {typeof children === "function"
        ? children({
            effective,
            resolved,
            toggleTheme,
          })
        : children}
      <style>{`::view-transition-old(root), ::view-transition-new(root){animation:none;mix-blend-mode:normal;}`}</style>
    </React.Fragment>
  );
}

export {
  ThemeToggler,
  type ThemeTogglerProps,
  type ThemeSelection,
  type Resolved,
  type Direction,
};
