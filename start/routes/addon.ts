import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const AddonsController = () => import('#controllers/addons_controller')

export default function addonsRoutes() {
  router
    .group(() => {
      router.get('/:id', [AddonsController, 'show']).as('addons.show')
      router.post('/:storeId', [AddonsController, 'store']).as('addons.store')
      router.put('/:id', [AddonsController, 'update']).as('addons.update')
      router.delete('/:id', [AddonsController, 'destroy']).as('addons.destroy')
    })
    .prefix('/addons')
    .use([middleware.auth(), throttle])
}
