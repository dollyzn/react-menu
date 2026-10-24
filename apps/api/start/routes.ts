/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'

import healthRoutes from '#routes/health'
import authRoutes from '#routes/auth'
import usersRoutes from '#routes/user'
import notificationsRoutes from '#routes/notifications'
import publicRoutes from '#routes/public'
import paymentRoutes from '#routes/payments'
import registerStoreCreateRoute from '#routes/store/store_create'
import registerStoreDetailRoutes from '#routes/store/store_detail'
import registerStoreDashboardRoutes from '#routes/store/dashboard'
import registerStoreCategoryRoutes from '#routes/store/categories'
import registerStoreItemRoutes from '#routes/store/items'
import registerStoreAddonRoutes from '#routes/store/addons'
import registerStoreInventoryRoutes from '#routes/store/inventory'
import registerStoreOrderRoutes from '#routes/store/orders'
import registerStoreMemberRoutes from '#routes/store/members'
import registerStoreReportRoutes from '#routes/store/reports'
import { authThrottle } from '#routes/store/shared'

healthRoutes()

// Guests may connect (order tracking); each channel authorizes itself in start/transmit.ts.
transmit.registerRoutes((route) => {
  route.use(middleware.silentAuth())
})

router
  .group(() => {
    router
      .group(() => {
        authRoutes()
        usersRoutes()
        notificationsRoutes()

        publicRoutes()
        paymentRoutes()
        registerStoreCreateRoute()

        router
          .group(() => {
            registerStoreDetailRoutes()
            registerStoreDashboardRoutes()
            registerStoreCategoryRoutes()
            registerStoreItemRoutes()
            registerStoreAddonRoutes()
            registerStoreInventoryRoutes()
            registerStoreMemberRoutes()
            registerStoreReportRoutes()
            registerStoreOrderRoutes()
          })
          .prefix('/stores/:storeId')
          .use([...authThrottle, middleware.storeAccess()])
      })
      .prefix('/v1')
  })
  .prefix('/api')
