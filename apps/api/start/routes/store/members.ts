import router from '@adonisjs/core/services/router'
import { managersOnly } from '#routes/store/shared'

const StoreMembersController = () => import('#controllers/store_members_controller')

/** The store's team: managers add people, change roles and remove them. */
export default function registerStoreMemberRoutes() {
  router
    .group(() => {
      router.get('/members', [StoreMembersController, 'index']).as('members.index')
      router.post('/members', [StoreMembersController, 'store']).as('members.store')
      router
        .post('/members/:userId/invite', [StoreMembersController, 'resendInvite'])
        .as('members.invite')
      router.put('/members/:userId', [StoreMembersController, 'update']).as('members.update')
      router.delete('/members/:userId', [StoreMembersController, 'destroy']).as('members.destroy')
    })
    .use(managersOnly)
}
