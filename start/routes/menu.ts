import router from '@adonisjs/core/services/router'
import { throttle } from '#start/limiter'

const MenuController = () => import('#controllers/menu_controller')

export default function menuRoutes() {
  router
    .group(() => {
      router.get('/:slug?', [MenuController, 'show']).as('menu.show')
    })
    .prefix('/menu')
    .use(throttle)
}
