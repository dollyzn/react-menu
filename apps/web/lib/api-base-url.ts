import { env } from "@/lib/env";

/** Garante base terminando em `/api/v1/` (prefixo das rotas REST documentadas). */
export function getApiBaseUrl(): string {
  const trimmed = env.NEXT_PUBLIC_API_URL.trim().replace(/\/?$/, "");
  if (trimmed.endsWith("/api/v1")) {
    return `${trimmed}/`;
  }
  return `${trimmed}/api/v1/`;
}

/** API origin without the REST prefix (Transmit routes live at the root). */
export function getApiOrigin(): string {
  return env.NEXT_PUBLIC_API_URL.trim()
    .replace(/\/?$/, "")
    .replace(/\/api\/v1$/, "");
}
