import "server-only";
import { headers } from "next/headers";
import type { ApiSuccess, PublicMenu } from "@react-menu/contracts";
import { serverApiBase } from "@/lib/server-api";

/**
 * Loads a store menu on the server (SSR). Returns null when the store does
 * not exist. Always fresh: availability and opening hours change often.
 * `track: false` for requests that aren't a customer visit (icons, manifests).
 */
export async function fetchMenu(slug?: string, { track = true } = {}): Promise<PublicMenu | null> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const query = track ? "" : "?preview=1";
  const response = await fetch(`${serverApiBase()}public/menu${slug ? `/${slug}` : ""}${query}`, {
    cache: "no-store",
    headers: { "user-agent": userAgent, accept: "application/json" },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Menu request failed with ${response.status}`);

  const body = (await response.json()) as ApiSuccess<PublicMenu>;
  return body.data;
}
