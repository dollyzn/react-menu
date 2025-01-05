import router from '@adonisjs/core/services/router'
import StoresController from '#controllers/stores_controller'
import CategoriesController from '#controllers/categories_controller'
import ItemsController from '#controllers/items_controller'
import AddonsController from '#controllers/addons_controller'
import DashboardController from '#controllers/dashboard_controller'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/', [StoresController, 'index']).as('stores.index')
    router.get('/:id', [StoresController, 'show']).as('stores.show')
    router.get('/:id/categories', [CategoriesController, 'index']).as('categories.index')
    router.get('/:id/items', [ItemsController, 'indexByStore']).as('items.indexByStore')
    router.get('/:id/addons', [AddonsController, 'index']).as('addons.index')
    router.post('/', [StoresController, 'store']).as('stores.store')
    router.put('/:id', [StoresController, 'update']).as('stores.update')
    router.patch('/:id/images', [StoresController, 'updateImages']).as('stores.updateImages')
    router.patch('/:id/status', [StoresController, 'updateStatus']).as('stores.updateStatus')
    router.delete('/:id', [StoresController, 'destroy']).as('stores.destroy')
    router
      .group(() => {
        router.get('/overview', [DashboardController, 'overview']).as('stores.dashboard.overview')
        router
          .get('/recent-items', [DashboardController, 'recentItems'])
          .as('stores.dashboard.recentItems')
      })
      .prefix('/:id/dashboard')
  })
  .use(middleware.auth())
  .prefix('/stores')
