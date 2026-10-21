import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Noto_Color_Emoji } from "next/font/google";

export const fontSans = GeistSans;

export const fontMono = GeistMono;

/**
 * Same emoji on every device (kitchen tablets may have no emoji font at
 * all). Not preloaded: Google Fonts serves only the glyphs a page uses.
 */
export const fontEmoji = Noto_Color_Emoji({
  weight: "400",
  subsets: ["emoji"],
  variable: "--font-noto-emoji",
  display: "swap",
  preload: false,
});
