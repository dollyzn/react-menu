import { isIP } from 'node:net'

/**
 * Proxies whose X-Forwarded-For we believe: this machine and private
 * networks. In Docker only Caddy (and the web container, for server
 * rendering) can reach the API, so the client IP they forward is the
 * customer's, and rate limits stop lumping every customer into one bucket.
 */
export function isTrustedProxy(address: string) {
  const ip = address.startsWith('::ffff:') ? address.slice(7) : address
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase()
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd')
  }
  return false
}
