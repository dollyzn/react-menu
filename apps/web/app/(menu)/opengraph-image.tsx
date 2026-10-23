import { fetchMenu } from "./_lib/fetch-menu";
import { OG_SIZE, storeOgImage } from "./_lib/store-og-image";

export const alt = "Cardápio da loja";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Link preview of the default store's menu ("/"). */
export default async function Image() {
  const store = await fetchMenu(undefined, { track: false })
    .then((menu) => menu?.store ?? null)
    .catch(() => null);
  return storeOgImage(store);
}
