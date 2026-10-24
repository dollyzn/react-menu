import router from '@adonisjs/core/services/router'
import { orderThrottle, throttle } from '#start/limiter'

const PublicMenuController = () => import('#controllers/public_menu_controller')

/** Customer-facing endpoints: no login, rate limited per IP. */
export default function publicRoutes() {
  router
    .group(() => {
      router.get('/stores', [PublicMenuController, 'stores']).as('public.stores')
      router.get('/menu', [PublicMenuController, 'show']).as('public.menu.default')
      router.get('/menu/:slug', [PublicMenuController, 'show']).as('public.menu')
      router
        .post('/menu/:slug/orders', [PublicMenuController, 'placeOrder'])
        .as('public.orders.store')
        .use(orderThrottle)
      router
        .get('/menu/:slug/my-orders', [PublicMenuController, 'myOrders'])
        .as('public.orders.mine')
      router.get('/orders', [PublicMenuController, 'lookupOrders']).as('public.orders.lookup')
      router
        .get('/orders/:token', [PublicMenuController, 'trackOrder'])
        .as('public.orders.show')
        .where('token', router.matchers.uuid())
      router
        .post('/orders/:token/payments', [PublicMenuController, 'payOrder'])
        .as('public.orders.pay')
        .where('token', router.matchers.uuid())
        .use(orderThrottle)
      // After a 3-D Secure challenge: read the attempt from the gateway now.
      router
        .post('/orders/:token/payments/sync', [PublicMenuController, 'syncPayment'])
        .as('public.orders.pay.sync')
        .where('token', router.matchers.uuid())
      // Development fake gateway only (404 otherwise).
      router
        .post('/orders/:token/payments/simulate', [PublicMenuController, 'simulatePayment'])
        .as('public.orders.pay.simulate')
        .where('token', router.matchers.uuid())
    })
    .prefix('/public')
    .use(throttle)
}
