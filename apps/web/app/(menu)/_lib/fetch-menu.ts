import "server-only";
import { headers } from "next/headers";
import type { ApiSuccess, PublicMenu } from "@react-menu/contracts";
import { getApiBaseUrl } from "@/lib/api-base-url";

/**
 * Loads a store menu on the server (SSR). Returns null when the store does
 * not exist. Always fresh: availability and opening hours change often.
 */
export async function fetchMenu(slug?: string): Promise<PublicMenu | null> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const response = await fetch(`${getApiBaseUrl()}public/menu${slug ? `/${slug}` : ""}`, {
    cache: "no-store",
    headers: { "user-agent": userAgent, accept: "application/json" },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Menu request failed with ${response.status}`);

  const body = (await response.json()) as ApiSuccess<PublicMenu>;
  return body.data;
}
