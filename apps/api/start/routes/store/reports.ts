import router from '@adonisjs/core/services/router'
import { managersOnly } from '#routes/store/shared'

const ReportsController = () => import('#controllers/reports_controller')

/** Sales reports: managers only. */
export default function registerStoreReportRoutes() {
  router.get('/reports/sales', [ReportsController, 'sales']).as('reports.sales').use(managersOnly)
}
