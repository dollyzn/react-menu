import router from '@adonisjs/core/services/router'

const AddonsController = () => import('#controllers/addons_controller')

export default function registerStoreAddonRoutes() {
  router.get('/addons', [AddonsController, 'index']).as('addons.index')
  router.post('/addons', [AddonsController, 'store']).as('addons.store')
  router.get('/addons/:addonId', [AddonsController, 'show']).as('addons.show')
  router.put('/addons/:addonId', [AddonsController, 'update']).as('addons.update')
  router.delete('/addons/:addonId', [AddonsController, 'destroy']).as('addons.destroy')
}
