import router from '@adonisjs/core/services/router'

const ItemsController = () => import('#controllers/items_controller')
const AddonsController = () => import('#controllers/addons_controller')

export default function registerStoreItemRoutes() {
  router.get('/items', [ItemsController, 'index']).as('items.index')
  router.patch('/items/update-order', [ItemsController, 'updateOrder']).as('items.updateOrder')
  router.get('/items/:itemId', [ItemsController, 'show']).as('items.show')
  router.put('/items/:itemId', [ItemsController, 'update']).as('items.update')
  router.delete('/items/:itemId', [ItemsController, 'destroy']).as('items.destroy')
  router.get('/items/:itemId/addons', [AddonsController, 'indexByItem']).as('addons.indexByItem')
}
