import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const StoresController = () => import('#controllers/stores_controller')

export default function storesRoutes() {
  router
    .group(() => {
      router.get('/', [StoresController, 'index']).as('stores.index')
      router.get('/:id', [StoresController, 'show']).as('stores.show')
      // router
      //   .get('/:id/categories', [CategoriesController, 'indexByStore'])
      //   .as('categories.indexByStore')
      // router.get('/:id/items', [ItemsController, 'indexByStore']).as('items.indexByStore')
      // router.get('/:id/addons', [AddonsController, 'indexByStore']).as('addons.indexByStore')
      router.post('/', [StoresController, 'store']).as('stores.store')
      router.put('/:id', [StoresController, 'update']).as('stores.update')
      router.patch('/:id/images', [StoresController, 'updateImages']).as('stores.updateImages')
      router.patch('/:id/status', [StoresController, 'updateStatus']).as('stores.updateStatus')
      router.delete('/:id', [StoresController, 'destroy']).as('stores.destroy')
      // router
      //   .group(() => {
      //     router.get('/overview', [DashboardController, 'overview']).as('stores.dashboard.overview')
      //     router
      //       .get('/recent-items', [DashboardController, 'recentItems'])
      //       .as('stores.dashboard.recentItems')
      //     router.get('/chart', [DashboardController, 'chart']).as('stores.dashboard.chart')
      //   })
      //   .prefix('/:id/dashboard')
    })
    .prefix('/stores')
    .use([middleware.auth(), throttle])
}
