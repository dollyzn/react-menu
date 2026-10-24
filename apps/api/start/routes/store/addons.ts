import { managersOnly } from '#routes/store/shared'
import router from '@adonisjs/core/services/router'

const AddonsController = () => import('#controllers/addons_controller')
const OptionGroupsController = () => import('#controllers/option_groups_controller')

export default function registerStoreAddonRoutes() {
  // Choice groups ("Escolha o queijo"): options are add-ons.
  router.get('/option-groups', [OptionGroupsController, 'index']).as('optionGroups.index')
  router
    .post('/option-groups', [OptionGroupsController, 'store'])
    .as('optionGroups.store')
    .use(managersOnly)
  router
    .put('/option-groups/:groupId', [OptionGroupsController, 'update'])
    .as('optionGroups.update')
    .use(managersOnly)
  router
    .delete('/option-groups/:groupId', [OptionGroupsController, 'destroy'])
    .as('optionGroups.destroy')
    .use(managersOnly)
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
