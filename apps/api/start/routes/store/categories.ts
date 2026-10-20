import { managersOnly } from '#routes/store/shared'
import router from '@adonisjs/core/services/router'

const CategoriesController = () => import('#controllers/categories_controller')
const ItemsController = () => import('#controllers/items_controller')

export default function registerStoreCategoryRoutes() {
  router.get('/categories', [CategoriesController, 'index']).as('categories.index')
  router
    .post('/categories', [CategoriesController, 'store'])
    .as('categories.store')
    .use(managersOnly)
  router
    .post('/categories/bulk-delete', [CategoriesController, 'bulkDelete'])
    .as('categories.bulkDelete')
    .use(managersOnly)
  router
    .put('/categories/order', [CategoriesController, 'reorder'])
    .as('categories.reorder')
    .use(managersOnly)
  router.get('/categories/:categoryId', [CategoriesController, 'show']).as('categories.show')
  router
    .put('/categories/:categoryId', [CategoriesController, 'update'])
    .as('categories.update')
    .use(managersOnly)
  router
    .delete('/categories/:categoryId', [CategoriesController, 'destroy'])
    .as('categories.destroy')
    .use(managersOnly)
  router
    .get('/categories/:categoryId/items', [ItemsController, 'indexByCategory'])
    .as('items.indexByCategory')
  router
    .post('/categories/:categoryId/items', [ItemsController, 'store'])
    .as('items.store')
    .use(managersOnly)
  router
    .put('/categories/:categoryId/items/order', [ItemsController, 'reorder'])
    .as('items.reorder')
    .use(managersOnly)
}
