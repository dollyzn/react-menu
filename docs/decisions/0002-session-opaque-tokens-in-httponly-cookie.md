# 0002. Sessions: opaque access tokens in an httpOnly cookie

- Status: Accepted
- Date: 2026-10-20

## Context

Auth already used AdonisJS database access tokens (opaque, only a hash is
stored) delivered in an httpOnly cookie, but tokens never expired and the
cookie lasted until 2038. A middleware injected `Bearer undefined` when the
cookie was missing, breaking Bearer clients.

## Decision

Keep opaque DB access tokens (`tokensGuard`), delivered in a signed,
httpOnly, `SameSite=Strict`, `Secure` (production) cookie. Tokens expire
after 7 days (`SESSION_TTL` in `app/models/user.ts`) and the cookie expires
with them. An explicit `Authorization` header wins over the cookie. The web
app treats only HTTP 401 as "session ended"; 429/5xx/offline are transient.

## Alternatives considered

- **Session guard (`@adonisjs/session`)**: equivalent security for a
  browser-only client, but a migration with no user-facing gain; tokens also
  serve non-browser clients and tests (`loginAs`).
- **JWT**: cannot be revoked without a denylist; logout/revocation matter
  more here than stateless verification.
- **Token in localStorage**: exposed to XSS.

## Consequences

- CSRF is mitigated by `SameSite=Strict` plus CORS restricted to
  `FRONTEND_URL` in production; web and API must be same-site, and because
  the cookie is host-only, the web route guard (`proxy.ts`) only sees it
  when both are served from the same host (e.g. a reverse proxy).
- No sliding renewal yet: users log in again after 7 days.
