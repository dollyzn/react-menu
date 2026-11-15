import "server-only";
import type { ApiSuccess, PublicMenu } from "@react-menu/contracts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serverApiBase, visitorHeaders } from "@/lib/server-api";
import { STORE_SLUG } from "@/utils/string";

/**
 * Loads a store menu on the server (SSR). Returns null when the store does
 * not exist. Always fresh: availability and opening hours change often.
 * `track: false` for requests that aren't a customer visit (icons, manifests).
 */
export async function fetchMenu(slug?: string, { track = true } = {}): Promise<PublicMenu | null> {
  // Not a store's slug (a scanner trying /config.json): no need to ask the API.
  if (slug !== undefined && !STORE_SLUG.test(slug)) return null;
  // A visit is a page load: the menu re-reading itself while open (an RSC
  // refresh, see MenuView) or moving around the app isn't another visitor.
  const query = track && !(await headers()).get("rsc") ? "" : "?preview=1";
  const response = await fetch(`${serverApiBase()}public/menu${slug ? `/${slug}` : ""}${query}`, {
    cache: "no-store",
    headers: await visitorHeaders(),
  });

  if (response.status === 404 || response.status === 429) {
    // Read (small) so the connection goes back to the pool. Not `cancel()`:
    // Next shares this response between metadata and page (a tee), and a
    // cancelled branch waits for the other one forever.
    await response.text().catch(() => undefined);
  }
  if (response.status === 404) return null;
  // Too many requests from this visitor (the API counts per IP): a page can't
  // answer 429 itself, so it goes to one that does instead of failing with 500.
  if (response.status === 429) redirect(`/muitos-acessos?next=${encodeURIComponent(slug ? `/${slug}` : "/")}`);
  if (!response.ok) throw new Error(`Menu request failed with ${response.status}`);

  const body = (await response.json()) as ApiSuccess<PublicMenu>;
  return body.data;
}
