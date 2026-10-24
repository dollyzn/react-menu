import { managersOnly } from '#routes/store/shared'
import router from '@adonisjs/core/services/router'

const DashboardController = () => import('#controllers/dashboard_controller')

export default function registerStoreDashboardRoutes() {
  router
    .group(() => {
      router.get('/today', [DashboardController, 'today']).as('stores.dashboard.today')
    })
    .prefix('/dashboard')
    .use(managersOnly)
}
