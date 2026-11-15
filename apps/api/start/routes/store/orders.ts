import router from '@adonisjs/core/services/router'
import { frontOfHouse, kitchenStaff, managersOnly } from '#routes/store/shared'

const OrdersController = () => import('#controllers/orders_controller')
const KitchenController = () => import('#controllers/kitchen_controller')
const CustomersController = () => import('#controllers/customers_controller')

export default function registerStoreOrderRoutes() {
  router.get('/orders', [OrdersController, 'index']).as('orders.index')
  router.post('/orders', [OrdersController, 'store']).as('orders.store').use(frontOfHouse)
  // "Pagar depois" (fiado) still open, any day: managers (before /:orderId).
  router
    .get('/orders/pay-later', [OrdersController, 'payLaterList'])
    .as('orders.payLater.index')
    .use(managersOnly)
  router.get('/orders/:orderId', [OrdersController, 'show']).as('orders.show')
  router
    .post('/orders/:orderId/complete', [OrdersController, 'complete'])
    .as('orders.complete')
    .use(frontOfHouse)
  // Managers cancel any order (a paid one is refunded); attendants only drop
  // one still waiting for its payment with nothing received (the controller).
  router
    .post('/orders/:orderId/cancel', [OrdersController, 'cancel'])
    .as('orders.cancel')
    .use(frontOfHouse)
  // Retry of an automatic refund that didn't go through (managers).
  router
    .post('/orders/:orderId/refund', [OrdersController, 'refund'])
    .as('orders.refund')
    .use(managersOnly)
  // Items added while the order waits in the queue (front of house, like the POS).
  router
    .post('/orders/:orderId/items', [OrdersController, 'addItems'])
    .as('orders.addItems')
    .use(frontOfHouse)
  // An order sent unpaid becomes "pagar depois" (front of house, like the POS).
  router
    .post('/orders/:orderId/pay-later', [OrdersController, 'payLater'])
    .as('orders.payLater')
    .use(frontOfHouse)
  router
    .post('/orders/:orderId/payment', [OrdersController, 'markPaid'])
    .as('orders.markPaid')
    .use(frontOfHouse)

  // POS autocomplete (names and phones: front of house only).
  router.get('/customers', [CustomersController, 'index']).as('customers.index').use(frontOfHouse)

  router.get('/kitchen/queue', [KitchenController, 'queue']).as('kitchen.queue').use(kitchenStaff)
  router
    .post('/kitchen/prepare', [KitchenController, 'prepare'])
    .as('kitchen.prepare')
    .use(kitchenStaff)
}
