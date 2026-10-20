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
  return limiter.allowRequests(60).every('1 minute').usingKey(`ip_${ctx.request.ip()}`)
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
