import app from '@adonisjs/core/services/app'
import env from '#start/env'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const origin = (url: string) => {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** FRONTEND_URL plus TRUSTED_ORIGINS (comma-separated), as origins. */
function trustedOrigins() {
  return new Set(
    [env.get('FRONTEND_URL'), ...(env.get('TRUSTED_ORIGINS') ?? '').split(',')]
      .map((value) => value.trim())
      .filter(Boolean)
      .map(origin)
      .filter((value): value is string => Boolean(value))
  )
}

/** Development on the machine or the local network (testing on a phone). */
function isLocal(value: string) {
  const host = new URL(value).hostname
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    /^(10|192\.168)\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

/**
 * Whether a write that carries the session cookie may use it: it must come
 * from the panel's own origin. SameSite already stops other sites; this also
 * stops another subdomain of the same site (or a page served there).
 * Requests without Origin and Sec-Fetch-Site aren't from a browser page.
 */
export function cookieWriteAllowed(input: {
  method: string
  origin?: string | null
  fetchSite?: string | null
}) {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true
  if (input.origin && input.origin !== 'null') {
    const from = origin(input.origin)
    if (!from) return false
    return trustedOrigins().has(from) || (!app.inProduction && isLocal(from))
  }
  if (input.fetchSite) return input.fetchSite === 'same-origin' || input.fetchSite === 'none'
  return true
}
