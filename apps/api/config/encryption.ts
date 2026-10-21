import env from '#start/env'
import { defineConfig, drivers } from '@adonisjs/core/encryption'

/**
 * Encrypts cookies, signed URLs and stored secrets (Mercado Pago
 * credentials). Data can't be decrypted if APP_KEY is lost or changed;
 * to rotate it, prepend the new key and keep the old one in the list.
 */
export default defineConfig({
  default: 'legacy',
  list: {
    legacy: drivers.legacy({
      keys: [env.get('APP_KEY')],
    }),
  },
})
