# 0019. CSRF and CSP without @adonisjs/shield and @adonisjs/session

- Status: Accepted
- Date: 2026-11-07

## Context

AdonisJS offers `@adonisjs/shield` (CSRF tokens, CSP, HSTS and other headers)
and `@adonisjs/session` (server-side sessions). They were considered during
the deploy security review.

React Menu's pages are rendered by the Next.js app; the AdonisJS app is a
JSON API. Staff sign in with an access token kept in an httpOnly,
`SameSite=Strict` cookie, which the API reads as a bearer token
(`CookieAuthMiddleware`). Web and API share one origin behind Caddy.

## Decision

Neither package is used.

- **Shield's CSRF protection** works by embedding a token in forms that
  AdonisJS renders, and none do. Cross-site writes are refused instead by
  `#helpers/trusted_origin`. A write that carries the session cookie must
  come from `FRONTEND_URL`, judged by `Origin` or `Sec-Fetch-Site`; any
  other write is answered with 403 `E_UNTRUSTED_ORIGIN`. `SameSite=Strict`
  already stops other sites. The origin check also covers another subdomain
  of the same site.
- **Shield's CSP** would apply to the API's JSON responses, which load
  nothing. The policy that matters is on the web's pages. It's a nonce-based
  `Content-Security-Policy` built in `apps/web/lib/csp.ts` and set by
  `proxy.ts`, starting as Report-Only.
- **Shield's other headers:** Caddy sends HSTS (with `includeSubDomains`)
  for everything, plus `nosniff` and `Referrer-Policy` on the API's answers.
  The web sends its own.
- **Sessions:** the access token (`DbAccessTokensProvider`) is the session.
  It slides on `/auth/me`, can be listed and revoked, and survives API
  restarts and several instances without a session store.

## Consequences

- One mechanism less to configure; the protections live where the pages
  and the cookie are.
- A future page rendered by AdonisJS (Edge templates) or a form posting to
  the API from another origin would need to revisit this: Shield's CSRF
  tokens or an allowed origin in `TRUSTED_ORIGINS`.
- New cookie-authenticated write endpoints are covered automatically by the
  origin check. Bearer-token and cookieless calls, such as webhooks, are
  not affected.
