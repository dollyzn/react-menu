import router from '@adonisjs/core/services/router'
import UsersController from '#controllers/users_controller'
import { middleware } from '#start/kernel'

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
