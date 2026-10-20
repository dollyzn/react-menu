import router from '@adonisjs/core/services/router'

const StoresController = () => import('#controllers/stores_controller')

export default function registerStoreDetailRoutes() {
  router.get('/', [StoresController, 'show']).as('stores.show')
  router.put('/', [StoresController, 'update']).as('stores.update')
  router.patch('/images', [StoresController, 'updateImages']).as('stores.updateImages')
  router.patch('/status', [StoresController, 'updateStatus']).as('stores.updateStatus')
  router.delete('/', [StoresController, 'destroy']).as('stores.destroy')
}
