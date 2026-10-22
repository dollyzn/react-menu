import { managersOnly } from '#routes/store/shared'
import router from '@adonisjs/core/services/router'

const AddonsController = () => import('#controllers/addons_controller')

export default function registerStoreAddonRoutes() {
  router.get('/addons', [AddonsController, 'index']).as('addons.index')
  router.post('/addons', [AddonsController, 'store']).as('addons.store').use(managersOnly)
  router
    .post('/addons/bulk-update', [AddonsController, 'bulkUpdate'])
    .as('addons.bulkUpdate')
    .use(managersOnly)
  router
    .post('/addons/bulk-delete', [AddonsController, 'bulkDelete'])
    .as('addons.bulkDelete')
    .use(managersOnly)
  router.get('/addons/:addonId', [AddonsController, 'show']).as('addons.show')
  router.put('/addons/:addonId', [AddonsController, 'update']).as('addons.update').use(managersOnly)
  router
    .delete('/addons/:addonId', [AddonsController, 'destroy'])
    .as('addons.destroy')
    .use(managersOnly)
}
