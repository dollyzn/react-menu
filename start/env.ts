/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),
  FRONTEND_URL: Env.schema.string({ format: 'url', tld: false }),

  AUTH_COOKIE_NAME: Env.schema.string(),
  AUTH_COOKIE_ENABLED: Env.schema.boolean(),

  ADMIN_USER: Env.schema.string({ format: 'email' }),
  ADMIN_PASS: Env.schema.string(),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  VAPID_PUBLIC_KEY: Env.schema.string(),
  VAPID_PRIVATE_KEY: Env.schema.string(),
  VAPID_CONTACT: Env.schema.string({ format: 'email' }),

  DRIVE_DISK: Env.schema.enum(['fs', 's3', 'r2'] as const),

  AWS_ACCESS_KEY_ID: Env.schema.string.optional(),
  AWS_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  AWS_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),

  R2_KEY: Env.schema.string(),
  R2_SECRET: Env.schema.string(),
  R2_BUCKET: Env.schema.string(),
  R2_ENDPOINT: Env.schema.string(),

  LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),

  GOOGLE_CLIENT_ID: Env.schema.string(),
  GOOGLE_CLIENT_SECRET: Env.schema.string(),
  GOOGLE_CALLBACK_URL: Env.schema.string(),

  TWITTER_CLIENT_ID: Env.schema.string(),
  TWITTER_CLIENT_SECRET: Env.schema.string(),
  TWITTER_CALLBACK_URL: Env.schema.string(),

  FACEBOOK_CLIENT_ID: Env.schema.string(),
  FACEBOOK_CLIENT_SECRET: Env.schema.string(),
  FACEBOOK_CALLBACK_URL: Env.schema.string(),

  HEALTH_CHECK_MONITORING_TOKEN: Env.schema.string(),
  HEALTH_CHECK_MONITORING_ALLOWLIST: Env.schema.string.optional(),

  HEALTH_DISK_WARN_PCT: Env.schema.number.optional(),
  HEALTH_DISK_FAIL_PCT: Env.schema.number.optional(),

  HEALTH_MEM_HEAP_WARN_MB: Env.schema.number.optional(),
  HEALTH_MEM_HEAP_FAIL_MB: Env.schema.number.optional(),

  HEALTH_MEM_RSS_WARN_MB: Env.schema.number.optional(),
  HEALTH_MEM_RSS_FAIL_MB: Env.schema.number.optional(),

  HEALTH_DB_CONN_WARN: Env.schema.number.optional(),
  HEALTH_DB_CONN_FAIL: Env.schema.number.optional(),

  HEALTH_REDIS_MEM_WARN_MB: Env.schema.number.optional(),
  HEALTH_REDIS_MEM_FAIL_MB: Env.schema.number.optional(),
})
