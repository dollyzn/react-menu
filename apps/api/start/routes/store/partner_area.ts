import router from '@adonisjs/core/services/router'

const PartnerAreaController = () => import('#controllers/partner_area_controller')
const PointController = () => import('#controllers/point_controller')

/**
 * The partner area (ADR 0024): the only store routes a partner reaches,
 * and only partners do (`storeAccess`). Charges reuse the POS's actions,
 * scoped to the partner's orders and machines.
 */
export default function registerPartnerAreaRoutes() {
  router
    .group(() => {
      router.get('/context', [PartnerAreaController, 'context']).as('context')
      router.get('/menu', [PartnerAreaController, 'menu']).as('menu')
      router.get('/orders', [PartnerAreaController, 'orders']).as('orders.index')
      router.post('/orders', [PartnerAreaController, 'store']).as('orders.store')
      router.get('/orders/:orderId', [PartnerAreaController, 'show']).as('orders.show')
      router.post('/orders/:orderId/cancel', [PartnerAreaController, 'cancel']).as('orders.cancel')
      router
        .post('/orders/:orderId/cancel-request', [PartnerAreaController, 'requestCancel'])
        .as('orders.requestCancel')
      router
        .post('/orders/:orderId/deliver', [PartnerAreaController, 'deliver'])
        .as('orders.deliver')
      router.get('/commissions', [PartnerAreaController, 'commissions']).as('commissions')

      router.get('/point/charges', [PointController, 'pendingCharges']).as('point.pendingCharges')
      router.post('/orders/:orderId/point-charges', [PointController, 'charge']).as('point.charge')
      router
        .get('/orders/:orderId/point-charges/:paymentId', [PointController, 'showCharge'])
        .as('point.showCharge')
      router
        .post('/orders/:orderId/point-charges/:paymentId/cancel', [PointController, 'cancelCharge'])
        .as('point.cancelCharge')
      router
        .post('/orders/:orderId/point-charges/:paymentId/simulate', [PointController, 'simulate'])
        .as('point.simulate')
    })
    .prefix('/partner')
    .as('partner')
}
