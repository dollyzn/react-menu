import { NextRequest, NextResponse } from "next/server";
import { env } from "./lib/env";
import { contentSecurityPolicy, cspNonce } from "./lib/csp";

/** Staff pages that work without a session. */
const AUTH_PAGES = ["/app/login"];
/**
 * Open with or without a session: a reset link may open on a logged-in
 * phone, and the social login popup lands on /app/social right after the
 * API set the session cookie.
 */
const PUBLIC_PAGES = ["/app/esqueci-minha-senha", "/app/redefinir-senha", "/app/social"];
/** Fetched by the browser without cookies when installing the staff app. */
const PUBLIC_FILES = ["/app/manifest.webmanifest"];

function isLoggedIn(req: NextRequest) {
  const token = req.cookies.get(env.NEXT_PUBLIC_AUTH_COOKIE_NAME)?.value;

  return Boolean(token);
}

const apiOrigin = (() => {
  try {
    return new URL(env.NEXT_PUBLIC_API_URL).origin;
  } catch {
    return null;
  }
})();

/**
 * Every page gets a Content-Security-Policy (Report-Only for now, see
 * lib/csp.ts) with a fresh nonce; Next reads it from the request header and
 * puts it on its scripts, and the root layout passes `x-nonce` to ours.
 */
function withCsp(req: NextRequest) {
  const nonce = cspNonce();
  const policy = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === "development", apiOrigin });
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy-report-only", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy-Report-Only", policy);
  return response;
}

/**
 * UX-only guard for the staff app (/app/*). The customer menu, order
 * tracking and every other route are public. The API enforces access.
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path !== "/app" && !path.startsWith("/app/")) return withCsp(req);
  if (PUBLIC_FILES.includes(path) || PUBLIC_PAGES.includes(path)) return withCsp(req);

  const isLogged = isLoggedIn(req);
  const isAuthPage = AUTH_PAGES.includes(path);

  if (!isAuthPage && !isLogged) {
    return NextResponse.redirect(new URL("/app/login", req.url));
  }

  if (isAuthPage && isLogged) {
    return NextResponse.redirect(new URL("/app/stores", req.url));
  }

  return withCsp(req);
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|csp-report|_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-touch-icon.png|favicon-16x16.png|favicon-96x96.png|favicon.svg|icon-192x192.png|icon-512x512.png|og-image.png|sitemap.xml|robots.txt|sw.js|offline.html|icons/|screenshots/).*)",
      // Link prefetches don't render HTML: no policy needed.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
