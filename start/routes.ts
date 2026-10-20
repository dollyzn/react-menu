/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

import healthRoutes from '#routes/health'
import authRoutes from '#routes/auth'
import usersRoutes from '#routes/user'
import registerStoreMenuPublicRoutes from '#routes/store/menu_public'
import registerStoreCreateRoute from '#routes/store/store_create'
import registerStoreDetailRoutes from '#routes/store/store_detail'
import registerStoreDashboardRoutes from '#routes/store/dashboard'
import registerStoreCategoryRoutes from '#routes/store/categories'
import registerStoreItemRoutes from '#routes/store/items'
import registerStoreAddonRoutes from '#routes/store/addons'
import { authThrottle } from '#routes/store/shared'

healthRoutes()

router
  .group(() => {
    router
      .group(() => {
        authRoutes()
        usersRoutes()

        registerStoreMenuPublicRoutes()
        registerStoreCreateRoute()

        router
          .group(() => {
            registerStoreDetailRoutes()
            registerStoreDashboardRoutes()
            registerStoreCategoryRoutes()
            registerStoreItemRoutes()
            registerStoreAddonRoutes()
          })
          .prefix('/stores/:storeId')
          .use([...authThrottle, middleware.storeAccess()])
      })
      .prefix('/v1')
  })
  .prefix('/api')
