import sharp from "sharp";
import { fetchMenu } from "@/app/(menu)/_lib/fetch-menu";
import { serverAssetUrl } from "@/lib/server-api";
import { STORE_ICON_FILES, type StoreIconFile } from "@/lib/store-icons";

/** The app's own icons, for stores without a logo (or an unreadable one). */
const FALLBACK: Record<StoreIconFile, string> = {
  "favicon-32.png": "/favicon.ico",
  "apple-touch-icon.png": "/icons/apple-touch-icon.png",
  "icon-192.png": "/icons/icon-192.png",
  "icon-512.png": "/icons/icon-512.png",
  "icon-maskable-512.png": "/icons/icon-maskable-512.png",
};

const rounded = (size: number) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}"/></svg>`);

/**
 * The logo whole (never cropped) on a white tile: transparent logos stay
 * visible on dark tabs and launchers, and any logo shape fits.
 */
async function onTile(logo: Buffer, size: number, inner: number) {
  const mark = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

async function render(logo: Buffer, file: StoreIconFile) {
  const { size, shape } = STORE_ICON_FILES[file];
  // Maskable: the OS crops to its own shape, so the logo keeps to the safe zone.
  const tile = await onTile(logo, size, Math.round(size * (shape === "maskable" ? 0.62 : 0.82)));
  if (shape !== "rounded") return tile; // iOS and maskable icons get their corners from the OS.
  return sharp(tile)
    .composite([{ input: rounded(size), blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * Favicon and PWA icons made from the store's logo (menu and panel), e.g.
 * /icons/store/jj-pasteis/icon-512.png?v=…; the `v` changes with the logo.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await params;
  if (!(file in STORE_ICON_FILES)) return new Response("Not found", { status: 404 });
  const iconFile = file as StoreIconFile;
  const fallback = () => Response.redirect(new URL(FALLBACK[iconFile], request.url), 307);

  const store = await fetchMenu(slug, { track: false })
    .then((menu) => menu?.store)
    .catch(() => null);
  if (!store?.photoUrl) return fallback();

  try {
    const logo = await fetch(serverAssetUrl(store.photoUrl), { cache: "no-store" });
    if (!logo.ok) return fallback();
    const png = await render(Buffer.from(await logo.arrayBuffer()), iconFile);
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        // Versioned URL (?v=): safe to keep for a long time.
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return fallback();
  }
}
