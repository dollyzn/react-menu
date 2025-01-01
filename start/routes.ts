/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from './kernel.js'
import router from '@adonisjs/core/services/router'
import AuthController from '#controllers/auth_controller'
import CategoriesController from '#controllers/categories_controller'
import ItemsController from '#controllers/items_controller'
import AddonsController from '#controllers/addons_controller'
import StoresController from '#controllers/stores_controller'
import MenuController from '#controllers/menu_controller'
import UsersController from '#controllers/users_controller'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})

router
  .group(() => {
    router.post('/login', [AuthController, 'login']).as('auth.login')
    router.get('/me', [AuthController, 'me']).as('auth.me')
    router
      .group(() => {
        router.post('/register', [AuthController, 'register']).as('auth.register')
        router.delete('/logout', [AuthController, 'logout']).as('auth.logout')
      })
      .use(middleware.auth())
  })
  .prefix('/auth')

router
  .group(() => {
    router.get('/', [UsersController, 'index']).as('users.index')
    router.get('/:id', [UsersController, 'show']).as('users.show')
    router.post('/', [UsersController, 'store']).as('users.store')
    router.put('/:id', [UsersController, 'update']).as('users.update')
    router.delete('/:id', [UsersController, 'destroy']).as('users.destroy')
  })
  .use(middleware.auth())
  .prefix('/users')

router
  .group(() => {
    router.get('/', [StoresController, 'index']).as('stores.index')
    router.get('/:id', [StoresController, 'show']).as('stores.show')
    router.get('/:id/categories', [CategoriesController, 'index']).as('categories.index')
    router.get('/:id/addons', [AddonsController, 'index']).as('addons.index')
    router.post('/', [StoresController, 'store']).as('stores.store')
    router.put('/:id', [StoresController, 'update']).as('stores.update')
    router.delete('/:id', [StoresController, 'destroy']).as('stores.destroy')
  })
  .use(middleware.auth())
  .prefix('/stores')

router
  .group(() => {
    router.get('/:id', [CategoriesController, 'show']).as('categories.show')
    router.get('/:id/items', [ItemsController, 'index']).as('items.index')
    router.post('/:storeId', [CategoriesController, 'store']).as('categories.store')
    router.put('/:id', [CategoriesController, 'update']).as('categories.update')
    router
      .patch('/update-order', [CategoriesController, 'updateOrder'])
      .as('categories.updateOrder')
    router.delete('/:id', [CategoriesController, 'destroy']).as('categories.destroy')
  })
  .use(middleware.auth())
  .prefix('/categories')

router
  .group(() => {
    router.get('/:id', [ItemsController, 'show']).as('items.show')
    router.post('/:categoryId', [ItemsController, 'store']).as('items.store')
    router.put('/:id', [ItemsController, 'update']).as('items.update')
    router.delete('/:id', [ItemsController, 'destroy']).as('items.destroy')
  })
  .use(middleware.auth())
  .prefix('/items')

router
  .group(() => {
    router.get('/:id', [AddonsController, 'show']).as('addons.show')
    router.post('/:storeId', [AddonsController, 'store']).as('addons.store')
    router.put('/:id', [AddonsController, 'update']).as('addons.update')
    router.delete('/:id', [AddonsController, 'destroy']).as('addons.destroy')
  })
  .use(middleware.auth())
  .prefix('/addons')

router
  .group(() => {
    router.get('/:slug?', [MenuController, 'show']).as('menu.show')
  })
  .prefix('/menu')
