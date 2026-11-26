/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import limiter from '@adonisjs/limiter/services/main'
import env from '#start/env'

export const throttle = limiter.define('global', (ctx) => {
  /**
   * Authenticated users are limited by user id. The admin issues several
   * requests per screen, so this must stay well above normal navigation.
   * Routes must run the auth middleware before this one, or the request
   * is counted as a guest.
   */
  if (ctx.auth.user) {
    return limiter.allowRequests(300).every('1 minute').usingKey(`user_${ctx.auth.user.id}`)
  }

  /**
   * Guests are limited by IP. Customers of the same restaurant often share
   * one IP (NAT), so this is per-network, not per-person. Login has its own
   * brute-force limiter in AuthService.
   */
  return limiter
    .allowRequests(env.get('PUBLIC_RATE_LIMIT', 120))
    .every('1 minute')
    .usingKey(`ip_${ctx.request.ip()}`)
})

/**
 * Public order creation: generous for a family ordering from one phone,
 * tight enough to stop scripted spam. Keyed by IP.
 */
export const orderThrottle = limiter.define('public_orders', (ctx) => {
  return limiter
    .allowRequests(env.get('PUBLIC_ORDER_RATE_LIMIT', 10))
    .every('10 minutes')
    .usingKey(`orders_${ctx.request.ip()}`)
})

/**
 * Re-reading a payment from the gateway (after a 3-D Secure challenge): each
 * call is a request to Mercado Pago with the store's token. The page syncs a
 * few times per challenge, so this stays well above that.
 */
export const paymentSyncThrottle = limiter.define('public_payment_sync', (ctx) => {
  return limiter.allowRequests(30).every('10 minutes').usingKey(`payment_sync_${ctx.request.ip()}`)
})

/**
 * Starting a customer's history sign-in (ADR 0025): each "code" start sends
 * a paid WhatsApp message (also limited per phone in CustomerLoginService).
 */
export const customerLoginThrottle = limiter.define('customer_login', (ctx) => {
  return (
    limiter
      // Per IP, and many customers share one (the store's Wi-Fi, carrier NAT):
      // the cost is limited per phone in CustomerLoginService.
      .allowRequests(env.get('CUSTOMER_LOGIN_RATE_LIMIT', 30))
      .every('10 minutes')
      .usingKey(`customer_login_${ctx.request.ip()}`)
  )
})

/**
 * Claiming a sign-in (the page polls every 2.5 s for up to 10 minutes, and
 * typed codes go here too), per IP and sign-in. The five attempts per code
 * are the real limit; this keeps one client from hammering a challenge.
 */
export const customerLoginClaimThrottle = limiter.define('customer_login_claim', (ctx) => {
  return (
    limiter
      .allowRequests(300)
      .every('10 minutes')
      // Per sign-in too: two customers polling from one IP don't share it.
      .usingKey(`customer_login_claim_${ctx.request.ip()}_${ctx.params.challengeId}`)
  )
})
