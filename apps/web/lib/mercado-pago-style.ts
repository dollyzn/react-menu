/**
 * The Mercado Pago Brick in the app's colors: its `customVariables` take
 * plain colors, ours are oklch tokens (some translucent) in
 * styles/globals.css, so they are read from the page and turned into hex,
 * translucent ones laid over the card they sit on. Browser only.
 */

type Rgba = { r: number; g: number; b: number; a: number };

let canvas: CanvasRenderingContext2D | null | undefined;

/** Any CSS color the browser knows, as RGBA (null if it can't parse it). */
function toRgba(color: string): Rgba | null {
  canvas ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!canvas || !color) return null;
  canvas.canvas.width = canvas.canvas.height = 1;
  canvas.fillStyle = "#010203";
  canvas.fillStyle = color;
  // Unparsed colors (an old browser without oklch) leave fillStyle as it was.
  if (canvas.fillStyle === "#010203" && color !== "#010203") return null;
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillRect(0, 0, 1, 1);
  // getImageData answers unpremultiplied values: the color and its alpha.
  const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

const hex = ({ r, g, b }: Rgba) =>
  `#${[r, g, b].map((value) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, "0")).join("")}`;

/** `top` over the opaque `bottom`. */
const over = (top: Rgba, bottom: Rgba): Rgba => ({
  r: Math.round(top.r * top.a + bottom.r * (1 - top.a)),
  g: Math.round(top.g * top.a + bottom.g * (1 - top.a)),
  b: Math.round(top.b * top.a + bottom.b * (1 - top.a)),
  a: 1,
});

export type BrickStyle = {
  theme: "default" | "dark";
  customVariables?: Record<string, string>;
};

export function mercadoPagoStyle(dark: boolean): BrickStyle {
  const theme = dark ? "dark" : "default";
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => toRgba(css.getPropertyValue(`--${name}`).trim());

  const card = token("card");
  const names = ["foreground", "muted-foreground", "primary", "primary-foreground", "input", "border", "ring", "destructive", "success"] as const;
  const colors = Object.fromEntries(names.map((name) => [name, token(name)]));
  // Without every color, the Brick's own theme is better than a half-made one.
  if (!card || names.some((name) => !colors[name])) return { theme };
  const solid = (name: (typeof names)[number]) => hex(over(colors[name]!, card));
  const ring = colors.ring!;

  const radius = parseFloat(css.getPropertyValue("--radius")) * 16 || 10;
  const px = (value: number) => `${Math.round(value)}px`;

  return {
    // The Brick's dark theme fixes some colors (light borders) over the
    // variables; its default theme takes them all, ours carry the dark mode.
    theme: "default",
    customVariables: {
      formBackgroundColor: hex(card),
      inputBackgroundColor: hex(card),
      textPrimaryColor: solid("foreground"),
      textSecondaryColor: solid("muted-foreground"),
      baseColor: solid("primary"),
      baseColorFirstVariant: solid("primary"),
      baseColorSecondVariant: solid("primary"),
      buttonTextColor: solid("primary-foreground"),
      outlinePrimaryColor: solid("border"),
      outlineSecondaryColor: solid("input"),
      errorColor: solid("destructive"),
      successColor: solid("success"),
      // The focus ring of the app's inputs (ring-3 ring-ring/50).
      inputFocusedBoxShadow: `0 0 0 3px rgba(${ring.r}, ${ring.g}, ${ring.b}, 0.5)`,
      inputErrorFocusedBoxShadow: `0 0 0 3px rgba(${colors.destructive!.r}, ${colors.destructive!.g}, ${colors.destructive!.b}, 0.4)`,
      inputBorderWidth: "1px",
      inputFocusedBorderWidth: "1px",
      borderRadiusSmall: px(radius * 0.6),
      borderRadiusMedium: px(radius * 0.8),
      borderRadiusLarge: px(radius),
      borderRadiusFull: "9999px",
      fontWeightNormal: "400",
      fontWeightSemiBold: "600",
    },
  };
}
