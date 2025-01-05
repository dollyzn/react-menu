import router from '@adonisjs/core/services/router'
import MenuController from '#controllers/menu_controller'

router
  .group(() => {
    router.get('/:slug?', [MenuController, 'show']).as('menu.show')
  })
  .prefix('/menu')
