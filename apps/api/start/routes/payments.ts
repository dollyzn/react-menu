import router from '@adonisjs/core/services/router'

const PaymentsController = () => import('#controllers/payments_controller')

export default function paymentRoutes() {
  router
    .post('/webhooks/mercado-pago/:storeId', [PaymentsController, 'mercadoPagoWebhook'])
    .as('payments.mercadoPago.webhook')
}
