import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/core/http'
import { isTrustedProxy } from '#helpers/trusted_proxy'

/**
 * The configuration settings used by the HTTP server
 */
export const http = defineConfig({
  generateRequestId: true,
  allowMethodSpoofing: false,

  /**
   * request.ip() is the client's address from X-Forwarded-For when the
   * request comes through a local/private proxy (Caddy, the web server's
   * SSR), not the proxy's own address.
   */
  trustProxy: (address: string) => isTrustedProxy(address),

  /**
   * Enabling async local storage will let you access HTTP context
   * from anywhere inside your application.
   */
  useAsyncLocalStorage: true,

  /**
   * Manage cookies configuration. The settings for the session id cookie are
   * defined inside the "config/session.ts" file.
   */
  cookie: {
    // e.g. ".example.com" when web and API live on different subdomains.
    domain: env.get('COOKIE_DOMAIN', ''),
    path: '/',
    maxAge: '2h',
    httpOnly: true,
    secure: app.inProduction,
    sameSite: 'lax',
  },
})
