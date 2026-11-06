/**
 * Whether OpenTelemetry was started for this process (otel.ts, preloaded by
 * the production commands with an endpoint). Everything OTel-specific in the
 * app (provider, middleware, queue hooks) loads only then: development, tests
 * and Ace commands skip it, and its ~0.6 s of imports.
 */
export function otelRunning() {
  return (globalThis as { __reactMenuOtel?: boolean }).__reactMenuOtel === true
}

const SECRET_QUERY_KEYS = ['token', 'tokens', 'code', 'state', 'vincular']

/**
 * A URL as it may be recorded in a trace: order tracking tokens in the path
 * (they open the order, the customer's name and phone) and capability values
 * in the query (tracking tokens, OAuth code/state) are masked.
 */
export function redactUrl(url: string) {
  const [path, query] = url.split('?', 2)
  const safePath = path.replace(/\/(orders|pedido)\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '/$1/:token')
  if (!query) return safePath
  const params = new URLSearchParams(query)
  for (const key of SECRET_QUERY_KEYS) if (params.has(key)) params.set(key, 'redacted')
  return `${safePath}?${params}`
}
