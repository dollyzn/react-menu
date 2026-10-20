// Generates the PWA icons in public/icons from the logo glyph.
//   node scripts/generate-pwa-icons.mjs
// "any" icons are a rounded tile; "maskable" ones fill the canvas and keep the
// glyph inside the 80% safe zone so Android can crop them to any shape.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const BRAND = "#c46014";
const GLYPH =
  "M127.9 78.4c-.8-8.2-7.7-14.4-15.9-14.4s-15.1 6.2-16 14.3L81.9 213.7c-1.3 6-1.9 12.1-1.9 18.2 0 45.9 35.1 83.6 80 87.7V544c0 17.7 14.3 32 32 32s32-14.3 32-32V319.6c44.9-4.1 80-41.8 80-87.7 0-6.1-.6-12.2-1.9-18.2L287.9 78.3c-.8-8.1-7.7-14.3-15.9-14.3s-15.1 6.2-15.9 14.4l-13.6 135.5c-.6 5.7-5.4 10.1-11.1 10.1-5.8 0-10.6-4.4-11.2-10.2L207.9 78.6c-.7-8.3-7.6-14.6-15.9-14.6s-15.2 6.3-15.9 14.6l-12.3 135.2c-.5 5.8-5.4 10.2-11.2 10.2s-10.6-4.4-11.1-10.1zM512 64c-16 0-128 32-128 176v112c0 35.3 28.7 64 64 64h32v128c0 17.7 14.3 32 32 32s32-14.3 32-32V96c0-17.7-14.3-32-32-32";

/** glyphScale: share of the canvas the 640-unit glyph box takes. */
function svg({ size, radius, glyphScale }) {
  const glyph = size * glyphScale;
  const offset = (size - glyph) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
  <svg x="${offset}" y="${offset}" width="${glyph}" height="${glyph}" viewBox="0 0 640 640">
    <path fill="#fff" d="${GLYPH}"/>
  </svg>
</svg>`);
}

const icons = [
  { file: "icon-192.png", size: 192, radius: 192 * 0.22, glyphScale: 0.62 },
  { file: "icon-512.png", size: 512, radius: 512 * 0.22, glyphScale: 0.62 },
  { file: "icon-maskable-512.png", size: 512, radius: 0, glyphScale: 0.5 },
  { file: "apple-touch-icon.png", size: 180, radius: 0, glyphScale: 0.58 },
];

const out = new URL("../public/icons/", import.meta.url);
await mkdir(out, { recursive: true });
for (const icon of icons) {
  await sharp(svg(icon)).png().toFile(new URL(icon.file, out).pathname);
  console.log("wrote", icon.file);
}
