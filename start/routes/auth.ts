import router from '@adonisjs/core/services/router'
import AuthController from '#controllers/auth_controller'
import { middleware } from '#start/kernel'

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
