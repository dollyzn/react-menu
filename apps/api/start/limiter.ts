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
