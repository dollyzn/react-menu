import { NextRequest, NextResponse } from "next/server";
import { env } from "./lib/env";

const PUBLIC_ROUTES = ["/app/login", "/app/social"];

function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.includes(path);
}

function isLoggedIn(req: NextRequest) {
  const token = req.cookies.get(env.NEXT_PUBLIC_AUTH_COOKIE_NAME)?.value;

  return Boolean(token);
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isLogged = isLoggedIn(req);
  const isPublic = isPublicRoute(path);

  if (!isPublic && !isLogged) {
    return NextResponse.redirect(new URL("/app/login", req.url));
  }

  if (isPublic && isLogged) {
    return NextResponse.redirect(new URL("/app/stores", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-touch-icon.png|favicon-16x16.png|favicon-96x96.png|favicon.svg|icon-192x192.png|icon-512x512.png|og-image.png|sitemap.xml|robots.txt|sw.js).*)",
  ],
};
