import router from '@adonisjs/core/services/router'
import ItemsController from '#controllers/items_controller'
import { middleware } from '#start/kernel'
import AddonsController from '#controllers/addons_controller'

router
  .group(() => {
    router.get('/:id', [ItemsController, 'show']).as('items.show')
    router.get('/:id/addons', [AddonsController, 'indexByItem']).as('addons.indexByItem')
    router.post('/:categoryId', [ItemsController, 'store']).as('items.store')
    router.put('/:id', [ItemsController, 'update']).as('items.update')
    router.patch('/update-order', [ItemsController, 'updateOrder']).as('items.updateOrder')
    router.delete('/:id', [ItemsController, 'destroy']).as('items.destroy')
  })
  .use(middleware.auth())
  .prefix('/items')
