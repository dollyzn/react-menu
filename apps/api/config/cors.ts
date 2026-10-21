import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'
import app from '@adonisjs/core/services/app'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: app.inProduction ? env.get('FRONTEND_URL') : '*',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  // Lets clients tell a replayed idempotent response apart.
  exposeHeaders: ['idempotent-replayed', 'retry-after'],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
