import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const UsersController = () => import('#controllers/users_controller')

export default function usersRoutes() {
  router
    .group(() => {
      router.get('/', [UsersController, 'index']).as('users.index')
      router.get('/:id', [UsersController, 'show']).as('users.show')
      router.post('/', [UsersController, 'store']).as('users.store')
      router.put('/:id', [UsersController, 'update']).as('users.update')
      router.delete('/:id', [UsersController, 'destroy']).as('users.destroy')
    })

    .prefix('/users')
    .use([middleware.auth(), throttle])
}
