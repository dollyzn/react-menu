import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { PublicMenu } from "@react-menu/contracts";
import { serverAssetUrl } from "@/lib/server-api";

export const OG_SIZE = { width: 1200, height: 630 };
const BRAND = "#c46014";

/** As a PNG data URL: the image renderer doesn't read WebP, and fetching here avoids its network rules. */
async function dataUrl(url: string | null, width: number, height: number, fit: "cover" | "contain") {
  if (!url) return null;
  try {
    const response = await fetch(serverAssetUrl(url), { cache: "no-store" });
    if (!response.ok) return null;
    const png = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(width, height, { fit, background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

const fonts = () =>
  Promise.all(
    (["Regular", "Bold"] as const).map(async (weight) => ({
      name: "Geist",
      data: await readFile(join(process.cwd(), `public/fonts/Geist-${weight}.ttf`)),
      weight: weight === "Bold" ? (700 as const) : (400 as const),
    }))
  );

/**
 * The link preview of a store's menu (WhatsApp, Instagram, Google): its
 * banner, logo, name and what it does. Plain brand colors when it has no
 * banner; the app's name when the store can't be read.
 */
export async function storeOgImage(store: PublicMenu["store"] | null) {
  const [banner, logo, fontData] = await Promise.all([
    dataUrl(store?.bannerUrl ?? null, OG_SIZE.width, OG_SIZE.height, "cover"),
    dataUrl(store?.photoUrl ?? null, 220, 220, "contain"),
    fonts(),
  ]);
  const name = store?.name ?? "Cardápio digital";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", background: BRAND, fontFamily: "Geist" }}>
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img>
          <img src={banner} alt="" width={OG_SIZE.width} height={OG_SIZE.height} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            // The image renderer (Satori) doesn't support the "inset" shorthand.
            backgroundImage: "linear-gradient(180deg, rgba(10,10,10,0.05) 0%, rgba(10,10,10,0.35) 45%, rgba(10,10,10,0.9) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 56, display: "flex", alignItems: "center", gap: 36 }}>
          {logo && (
            <div style={{ display: "flex", width: 168, height: 168, borderRadius: 36, background: "#ffffff", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
              <img src={logo} alt="" width={136} height={136} style={{ objectFit: "contain" }} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", color: "#ffffff" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#ffd2ad", letterSpacing: 2, textTransform: "uppercase" }}>Cardápio</div>
            <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
            <div style={{ fontSize: 30, marginTop: 14, color: "#f5f5f5" }}>
              {store?.address ? `Peça pelo celular · ${store.address}` : "Peça pelo celular e retire no balcão"}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fontData }
  );
}
