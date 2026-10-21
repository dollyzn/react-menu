import router from '@adonisjs/core/services/router'
import { frontOfHouse } from '#routes/store/shared'

const OrdersController = () => import('#controllers/orders_controller')
const KitchenController = () => import('#controllers/kitchen_controller')
const CustomersController = () => import('#controllers/customers_controller')

export default function registerStoreOrderRoutes() {
  router.get('/orders', [OrdersController, 'index']).as('orders.index')
  router.post('/orders', [OrdersController, 'store']).as('orders.store').use(frontOfHouse)
  router.get('/orders/:orderId', [OrdersController, 'show']).as('orders.show')
  router
    .post('/orders/:orderId/complete', [OrdersController, 'complete'])
    .as('orders.complete')
    .use(frontOfHouse)
  router
    .post('/orders/:orderId/cancel', [OrdersController, 'cancel'])
    .as('orders.cancel')
    .use(frontOfHouse)
  router
    .post('/orders/:orderId/payment', [OrdersController, 'markPaid'])
    .as('orders.markPaid')
    .use(frontOfHouse)

  // POS autocomplete (names and phones: front of house only).
  router.get('/customers', [CustomersController, 'index']).as('customers.index').use(frontOfHouse)

  router.get('/kitchen/queue', [KitchenController, 'queue']).as('kitchen.queue')
  router.post('/kitchen/prepare', [KitchenController, 'prepare']).as('kitchen.prepare')
}
