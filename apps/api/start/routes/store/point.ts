import router from '@adonisjs/core/services/router'
import { frontOfHouse, managersOnly } from '#routes/store/shared'

const PointController = () => import('#controllers/point_controller')

/** Mercado Pago Point card machines (ADR 0020). */
export default function registerStorePointRoutes() {
  router.get('/point', [PointController, 'show']).as('point.show').use(frontOfHouse)
  router
    .get('/point/terminals', [PointController, 'terminals'])
    .as('point.terminals')
    .use(managersOnly)
  router
    .put('/point/settings', [PointController, 'updateSettings'])
    .as('point.settings')
    .use(managersOnly)
  router.post('/point/terminals', [PointController, 'enable']).as('point.enable').use(managersOnly)
  router
    .delete('/point/terminals/:terminalId', [PointController, 'disable'])
    .as('point.disable')
    .use(managersOnly)

  router
    .post('/orders/:orderId/point-charges', [PointController, 'charge'])
    .as('point.charge')
    .use(frontOfHouse)
  router
    .get('/orders/:orderId/point-charges/:paymentId', [PointController, 'showCharge'])
    .as('point.showCharge')
    .use(frontOfHouse)
  router
    .post('/orders/:orderId/point-charges/:paymentId/cancel', [PointController, 'cancelCharge'])
    .as('point.cancelCharge')
    .use(frontOfHouse)
  router
    .post('/orders/:orderId/point-charges/:paymentId/simulate', [PointController, 'simulate'])
    .as('point.simulate')
    .use(frontOfHouse)
}
