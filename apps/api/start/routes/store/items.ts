import { managersOnly } from '#routes/store/shared'
import router from '@adonisjs/core/services/router'

const ItemsController = () => import('#controllers/items_controller')
const AddonsController = () => import('#controllers/addons_controller')

export default function registerStoreItemRoutes() {
  router.get('/items', [ItemsController, 'index']).as('items.index')
  router
    .post('/items/bulk-update', [ItemsController, 'bulkUpdate'])
    .as('items.bulkUpdate')
    .use(managersOnly)
  router
    .post('/items/bulk-delete', [ItemsController, 'bulkDelete'])
    .as('items.bulkDelete')
    .use(managersOnly)
  router.get('/items/:itemId', [ItemsController, 'show']).as('items.show')
  router.put('/items/:itemId', [ItemsController, 'update']).as('items.update').use(managersOnly)
  router
    .delete('/items/:itemId', [ItemsController, 'destroy'])
    .as('items.destroy')
    .use(managersOnly)
  router
    .put('/items/:itemId/photo', [ItemsController, 'updatePhoto'])
    .as('items.photo.update')
    .use(managersOnly)
  router
    .delete('/items/:itemId/photo', [ItemsController, 'destroyPhoto'])
    .as('items.photo.destroy')
    .use(managersOnly)
  router.get('/items/:itemId/addons', [AddonsController, 'indexByItem']).as('addons.indexByItem')
}
