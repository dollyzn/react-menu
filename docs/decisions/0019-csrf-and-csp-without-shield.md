# 0019. CSRF and CSP without @adonisjs/shield and @adonisjs/session

- Status: Accepted
- Date: 2026-11-07

## Context

AdonisJS offers `@adonisjs/shield` (CSRF tokens, CSP, HSTS and other headers)
and `@adonisjs/session` (server-side sessions). They were considered during
the deploy security review.

React Menu's pages are rendered by the Next.js app; the AdonisJS app is a
JSON API. Staff sign in with an access token kept in an httpOnly,
`SameSite=Lax` cookie (`Strict` until 2026-11-08, see below), which the API reads as a bearer token
(`CookieAuthMiddleware`). Web and API share one origin behind Caddy.

## Decision

Neither package is used.

- **Shield's CSRF protection** works by embedding a token in forms that
  AdonisJS renders, and none do. Cross-site writes are refused instead by
  `#helpers/trusted_origin`. A write that carries the session cookie must
  come from `FRONTEND_URL`, judged by `Origin` or `Sec-Fetch-Site`; any
  other write is answered with 403 `E_UNTRUSTED_ORIGIN`. The origin check
  also covers another subdomain of the same site.
- **The session cookie is `SameSite=Lax`.** With `Strict`, a link to the
  panel from another site arrived signed out. That broke "Abrir no painel" in
  notification e-mails and the installed staff app's launch on Android: both
  passed through the login page. `Lax` sends the cookie only on top-level
  GET navigations from other sites. It still keeps it off every cross-site
  POST, PUT or DELETE, `fetch`, iframe and image, so cross-site writes stay
  refused twice, by `Lax` and by the origin check. Other sites still can't
  read panel pages (same-origin policy). The only page that acted on a GET
  was `/app/logout`. It now signs out at once only when the panel's own
  "Sair" asked, through a mark in the page's memory (`lib/logout-intent.ts`)
  that another site can't set. Opened any other way, it asks first. The
  other auth cookies (`trusted_device`, `two_factor_challenge`) were already
  `Lax`.
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
