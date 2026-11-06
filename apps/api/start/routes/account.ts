import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { throttle } from '#start/limiter'

const AccountController = () => import('#controllers/account_controller')

/** /account: the signed-in user's profile, photo, password and sessions. */
export default function accountRoutes() {
  router
    .group(() => {
      router.get('/sessions', [AccountController, 'sessions']).as('account.sessions')
      router
        .delete('/sessions/:id', [AccountController, 'revokeSession'])
        .as('account.sessions.revoke')
      router
        .delete('/sessions', [AccountController, 'revokeOtherSessions'])
        .as('account.sessions.revokeOthers')
      router.put('/profile', [AccountController, 'updateProfile']).as('account.profile')
      router.put('/avatar', [AccountController, 'setAvatar']).as('account.avatar')
      router.delete('/avatar', [AccountController, 'removeAvatar']).as('account.avatar.remove')
      router.put('/password', [AccountController, 'changePassword']).as('account.password')
    })
    .prefix('/account')
    .use([middleware.auth(), throttle])
}
