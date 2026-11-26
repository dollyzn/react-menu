import router from '@adonisjs/core/services/router'
import { managersOnly } from '#routes/store/shared'

const WhatsAppController = () => import('#controllers/whatsapp_controller')

/** The store's WhatsApp number (ADR 0025): managers only. */
export default function registerStoreWhatsAppRoutes() {
  router
    .group(() => {
      router.get('/', [WhatsAppController, 'show']).as('show')
      router.post('/', [WhatsAppController, 'connect']).as('connect')
      router.post('/refresh', [WhatsAppController, 'refresh']).as('refresh')
      router.put('/settings', [WhatsAppController, 'updateSettings']).as('settings')
      router.get('/messages', [WhatsAppController, 'messages']).as('messages')
      router.delete('/', [WhatsAppController, 'disconnect']).as('disconnect')
    })
    .prefix('/whatsapp')
    .as('stores.whatsapp')
    .use(managersOnly)
}
