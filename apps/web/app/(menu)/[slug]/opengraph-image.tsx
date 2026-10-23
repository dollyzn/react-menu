import { fetchMenu } from "../_lib/fetch-menu";
import { OG_SIZE, storeOgImage } from "../_lib/store-og-image";

export const alt = "Cardápio da loja";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Link preview of a store's menu ("/<slug>"). */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const store = await fetchMenu((await params).slug, { track: false })
    .then((menu) => menu?.store ?? null)
    .catch(() => null);
  return storeOgImage(store);
}
