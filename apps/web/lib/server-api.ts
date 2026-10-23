import "server-only";
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
