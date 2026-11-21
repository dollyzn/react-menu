import router from '@adonisjs/core/services/router'
import { managersOnly } from '#routes/store/shared'

const PartnersController = () => import('#controllers/partners_controller')
const PartnerCommissionsController = () => import('#controllers/partner_commissions_controller')
const CancelRequestsController = () => import('#controllers/cancel_requests_controller')

/**
 * The managers' side of partners (ADR 0024): rules, what they may sell,
 * pausing. The partners' own routes are in `partner_area.ts`.
 */
export default function registerStorePartnerRoutes() {
  router
    .group(() => {
      router.get('/partners', [PartnersController, 'index']).as('partners.index')
      router.post('/partners', [PartnersController, 'store']).as('partners.store')
      router.get('/partners/:partnerId', [PartnersController, 'show']).as('partners.show')
      router.put('/partners/:partnerId', [PartnersController, 'update']).as('partners.update')
      router.put('/partners/:partnerId/pause', [PartnersController, 'pause']).as('partners.pause')
      router
        .put('/partners/:partnerId/catalog', [PartnersController, 'catalog'])
        .as('partners.catalog')
      router
        .get('/partners/:partnerId/stats', [PartnerCommissionsController, 'stats'])
        .as('partners.stats')
      router
        .get('/partners/:partnerId/sales', [PartnerCommissionsController, 'sales'])
        .as('partners.sales')
      router
        .get('/partners/:partnerId/settlements', [PartnerCommissionsController, 'settlements'])
        .as('partners.settlements.index')
      router
        .post('/partners/:partnerId/settlements', [PartnerCommissionsController, 'settle'])
        .as('partners.settlements.store')
      router
        .delete('/partners/:partnerId/settlements/:settlementId', [
          PartnerCommissionsController,
          'undo',
        ])
        .as('partners.settlements.destroy')

      // Cancellation requests (a partner past their window).
      router.get('/cancel-requests', [CancelRequestsController, 'index']).as('cancelRequests.index')
      router
        .post('/orders/:orderId/cancel-requests/:requestId/approve', [
          CancelRequestsController,
          'approve',
        ])
        .as('cancelRequests.approve')
      router
        .post('/orders/:orderId/cancel-requests/:requestId/reject', [
          CancelRequestsController,
          'reject',
        ])
        .as('cancelRequests.reject')
    })
    .use(managersOnly)
}
