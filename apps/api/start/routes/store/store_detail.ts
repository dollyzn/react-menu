import { frontOfHouse, managersOnly } from '#routes/store/shared'
import router from '@adonisjs/core/services/router'

const StoresController = () => import('#controllers/stores_controller')
const PaymentsController = () => import('#controllers/payments_controller')

export default function registerStoreDetailRoutes() {
  router.get('/', [StoresController, 'show']).as('stores.show')
  router.put('/', [StoresController, 'update']).as('stores.update').use(managersOnly)
  router
    .patch('/images', [StoresController, 'updateImages'])
    .as('stores.updateImages')
    .use(managersOnly)
  router
    .patch('/status', [StoresController, 'updateStatus'])
    .as('stores.updateStatus')
    .use(frontOfHouse)
  router.put('/hours', [StoresController, 'updateHours']).as('stores.updateHours').use(managersOnly)
  router
    .put('/payment-settings', [PaymentsController, 'updateSettings'])
    .as('stores.paymentSettings')
    .use(managersOnly)
  router.delete('/', [StoresController, 'destroy']).as('stores.destroy').use(managersOnly)
}
