import router from '@adonisjs/core/services/router'

const StoresController = () => import('#controllers/stores_controller')
import { authThrottle } from '#routes/store/shared'

export default function registerStoreCreateRoute() {
  router.post('/stores', [StoresController, 'store']).use(authThrottle)
}
