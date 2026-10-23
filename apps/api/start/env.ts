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
  /** Cookie domain when web and API are on different subdomains (".example.com"). */
  COOKIE_DOMAIN: Env.schema.string.optional(),

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

  FIREBASE_PROJECT_ID: Env.schema.string.optional(),
  FIREBASE_CLIENT_EMAIL: Env.schema.string.optional(),
  FIREBASE_PRIVATE_KEY: Env.schema.string.optional(),

  DRIVE_DISK: Env.schema.enum(['fs', 's3', 'r2'] as const),

  AWS_ACCESS_KEY_ID: Env.schema.string.optional(),
  AWS_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  AWS_REGION: Env.schema.string.optional(),
  S3_BUCKET: Env.schema.string.optional(),

  R2_KEY: Env.schema.string.optional(),
  R2_SECRET: Env.schema.string.optional(),
  R2_BUCKET: Env.schema.string.optional(),
  R2_ENDPOINT: Env.schema.string.optional(),

  LIMITER_STORE: Env.schema.enum(['redis', 'memory'] as const),

  /** Development only: a local Pix gateway to try the checkout without credentials. */
  PAYMENTS_FAKE_GATEWAY: Env.schema.boolean.optional(),
  /** Guest requests per client IP per minute (default 120). */
  PUBLIC_RATE_LIMIT: Env.schema.number.optional(),
  /** Public orders per IP every 10 minutes (default 10). */
  PUBLIC_ORDER_RATE_LIMIT: Env.schema.number.optional(),

  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  GOOGLE_CALLBACK_URL: Env.schema.string.optional(),

  TWITTER_CLIENT_ID: Env.schema.string.optional(),
  TWITTER_CLIENT_SECRET: Env.schema.string.optional(),
  TWITTER_CALLBACK_URL: Env.schema.string.optional(),

  FACEBOOK_CLIENT_ID: Env.schema.string.optional(),
  FACEBOOK_CLIENT_SECRET: Env.schema.string.optional(),
  FACEBOOK_CALLBACK_URL: Env.schema.string.optional(),

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

  /*
  |----------------------------------------------------------
  | Variables for configuring @adonisjs/queue
  |----------------------------------------------------------
  */
  QUEUE_DRIVER: Env.schema.enum.optional(['redis', 'database', 'sync'] as const),
  /** Redis key prefix of the job queue (default "react-menu:"). */
  QUEUE_REDIS_PREFIX: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Mail (@adonisjs/mail). All optional: development defaults to Mailpit
  | on localhost:1025.
  |----------------------------------------------------------
  */
  MAIL_MAILER: Env.schema.enum.optional(['smtp'] as const),
  MAIL_FROM_NAME: Env.schema.string.optional(),
  MAIL_FROM_ADDRESS: Env.schema.string.optional({ format: 'email' }),
  SMTP_HOST: Env.schema.string.optional({ format: 'host' }),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_SECURE: Env.schema.boolean.optional(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),
})
