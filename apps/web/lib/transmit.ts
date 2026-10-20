import { Transmit } from "@adonisjs/transmit-client";
import { getApiOrigin } from "@/lib/api-base-url";

let client: Transmit | null = null;

/**
 * Browser-only Transmit (SSE) client. The connection opens on first use and
 * authenticates with the httpOnly session cookie.
 */
export function getTransmit(): Transmit {
  if (typeof window === "undefined") {
    throw new Error("Transmit is only available in the browser.");
  }

  client ??= new Transmit({ baseUrl: getApiOrigin() });
  return client;
}

/** Closes the SSE connection, e.g. on logout. */
export function closeTransmit() {
  client?.close();
  client = null;
}
