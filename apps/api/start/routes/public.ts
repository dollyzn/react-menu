import router from '@adonisjs/core/services/router'
import { orderThrottle, throttle } from '#start/limiter'

const PublicMenuController = () => import('#controllers/public_menu_controller')

/** Customer-facing endpoints: no login, rate limited per IP. */
export default function publicRoutes() {
  router
    .group(() => {
      router.get('/menu', [PublicMenuController, 'show']).as('public.menu.default')
      router.get('/menu/:slug', [PublicMenuController, 'show']).as('public.menu')
      router
        .post('/menu/:slug/orders', [PublicMenuController, 'placeOrder'])
        .as('public.orders.store')
        .use(orderThrottle)
      router
        .get('/orders/:token', [PublicMenuController, 'trackOrder'])
        .as('public.orders.show')
        .where('token', router.matchers.uuid())
    })
    .prefix('/public')
    .use(throttle)
}
