import router from '@adonisjs/core/services/router'
import AddonsController from '#controllers/addons_controller'
import { middleware } from '#start/kernel'

router
  .group(() => {
    router.get('/:id', [AddonsController, 'show']).as('addons.show')
    router.post('/:storeId', [AddonsController, 'store']).as('addons.store')
    router.put('/:id', [AddonsController, 'update']).as('addons.update')
    router.delete('/:id', [AddonsController, 'destroy']).as('addons.destroy')
  })
  .use(middleware.auth())
  .prefix('/addons')
