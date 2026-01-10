import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const SocialAuthController = () => import('#controllers/social_auth_controller')

export default function authRoutes() {
  router
    .group(() => {
      router.post('/login', [AuthController, 'login']).as('auth.login')
      router.get('/me', [AuthController, 'me']).use(throttle).as('auth.me')

      router
        .group(() => {
          router.post('/register', [AuthController, 'register']).as('auth.register')
          router
            .delete('/logout', [AuthController, 'logout'])
            .as('auth.logout')
            .use(middleware.auth())
        })
        .use(throttle)

      router
        .group(() => {
          router
            .get('/:provider/redirect', [SocialAuthController, 'redirect'])
            .as('social.redirect')
          router
            .get('/:provider/callback', [SocialAuthController, 'callback'])
            .as('social.callback')
        })
        .prefix('/social')
        .where('provider', /google|twitter|facebook/)
    })

    .prefix('/auth')
}
