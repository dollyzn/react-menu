import "server-only";
import { headers } from "next/headers";
import { getApiBaseUrl, getApiOrigin } from "@/lib/api-base-url";

/** REST base for server-side requests: in Docker, the API over the internal network. */
export function serverApiBase() {
  return process.env.API_INTERNAL_URL
    ? `${process.env.API_INTERNAL_URL.replace(/\/$/, "")}/`
    : getApiBaseUrl();
}

/**
 * A public API URL (e.g. an uploaded logo) as the server reaches it: the
 * web container can't always reach the public address of its own host.
 */
export function serverAssetUrl(url: string) {
  const internal = process.env.API_INTERNAL_URL?.replace(/\/$/, "").replace(/\/api\/v1$/, "");
  const publicOrigin = getApiOrigin();
  return internal && url.startsWith(publicOrigin) ? internal + url.slice(publicOrigin.length) : url;
}

/**
 * Headers for server-side calls made on behalf of a visitor: their address
 * (the API trusts it from the web server, so per-IP limits count each
 * customer, not the server) and user agent.
 */
export async function visitorHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const forwarded = incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip");
  return {
    accept: "application/json",
    "user-agent": incoming.get("user-agent") ?? "",
    ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
  };
}
