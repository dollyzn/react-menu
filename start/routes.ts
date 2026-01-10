/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

import addonsRoutes from '#routes/addon'
import authRoutes from '#routes/auth'
import categoriesRoutes from '#routes/category'
import itemsRoutes from '#routes/item'
import menuRoutes from '#routes/menu'
import storesRoutes from '#routes/store'
import usersRoutes from '#routes/user'

router
  .group(() => {
    router
      .group(() => {
        addonsRoutes()
        authRoutes()
        categoriesRoutes()
        itemsRoutes()
        menuRoutes()
        storesRoutes()
        usersRoutes()
      })
      .prefix('/v1')
  })
  .prefix('/api')
