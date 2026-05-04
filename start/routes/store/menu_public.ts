import router from '@adonisjs/core/services/router'
import { throttle } from '#start/limiter'

const MenuController = () => import('#controllers/menu_controller')

export default function registerStoreMenuPublicRoutes() {
  router.get('/stores/:storeId/menu', [MenuController, 'show']).use(throttle)
}
