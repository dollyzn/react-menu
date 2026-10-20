import { managersOnly } from '#routes/store/shared'
import router from '@adonisjs/core/services/router'

const DashboardController = () => import('#controllers/dashboard_controller')

export default function registerStoreDashboardRoutes() {
  router
    .group(() => {
      router.get('/overview', [DashboardController, 'overview']).as('stores.dashboard.overview')
      router
        .get('/recent-items', [DashboardController, 'recentItems'])
        .as('stores.dashboard.recentItems')
      router.get('/chart', [DashboardController, 'chart']).as('stores.dashboard.chart')
    })
    .prefix('/dashboard')
    .use(managersOnly)
}
