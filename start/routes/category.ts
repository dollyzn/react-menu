import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const CategoriesController = () => import('#controllers/categories_controller')

export default function categoriesRoutes() {
  router
    .group(() => {
      router.get('/:id', [CategoriesController, 'show']).as('categories.show')
      // router.get('/:id/items', [ItemsController, 'indexByCategory']).as('items.indexByCategory')
      router.post('/bulk-delete', [CategoriesController, 'bulkDelete']).as('categories.bulkDelete')
      router.post('/:storeId', [CategoriesController, 'store']).as('categories.store')
      router.put('/:id', [CategoriesController, 'update']).as('categories.update')
      router
        .patch('/update-order', [CategoriesController, 'updateOrder'])
        .as('categories.updateOrder')
      router.delete('/:id', [CategoriesController, 'destroy']).as('categories.destroy')
    })

    .prefix('/categories')
    .use([middleware.auth(), throttle])
}
