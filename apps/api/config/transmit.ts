import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/transmit'
import { redis } from '@adonisjs/transmit/transports/redis'

export default defineConfig({
  /**
   * Keeps idle SSE connections alive through proxies and load balancers.
   */
  pingInterval: '30s',

  /**
   * Redis pub/sub fans broadcasts out to every API instance. Tests run a
   * single in-process server, so no transport is needed there.
   */
  transport: app.inTest
    ? null
    : {
        driver: redis({
          host: env.get('REDIS_HOST'),
          port: env.get('REDIS_PORT'),
          password: env.get('REDIS_PASSWORD') || undefined,
        }),
      },
})
