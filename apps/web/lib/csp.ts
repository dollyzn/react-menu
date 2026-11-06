/**
 * The web's Content-Security-Policy (sent as Report-Only first: violations
 * go to /csp-report and nothing is blocked). Scripts need this request's
 * nonce ('strict-dynamic' lets them load what they load: the Mercado Pago
 * Brick, Firebase). Styles stay 'unsafe-inline' (Next, Tailwind and the UI
 * libraries inject inline styles). Images come from anywhere over HTTPS
 * (item photos, DiceBear avatars, card brands); frames too, since 3-D Secure
 * opens the card issuer's own page.
 */
export function contentSecurityPolicy(nonce: string, options: { dev: boolean; apiOrigin: string | null }) {
  const api = options.apiOrigin ? ` ${options.apiOrigin}` : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:" + (options.dev ? " http:" : ""),
    "font-src 'self' data: https:",
    // The API (SSE included), Mercado Pago, Firebase push, dev hot reload.
    `connect-src 'self'${api} https://*.mercadopago.com https://*.mercadolibre.com https://*.mlstatic.com https://*.googleapis.com${options.dev ? " ws: http:" : ""}`,
    "frame-src 'self' https:",
    // Some libraries start workers from blob: URLs (order and settings pages).
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https:",
    "frame-ancestors 'none'",
    "report-uri /csp-report",
  ];
  return directives.join("; ");
}

/** A fresh nonce per request (base64 of 16 random bytes). */
export function cspNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
