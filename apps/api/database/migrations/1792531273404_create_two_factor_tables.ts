import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Two-factor sign-in: every login needs a second step after the password (or
 * Google). Until an authenticator app (TOTP) is set up, it is a code sent by
 * e-mail.
 *
 * - users: the TOTP secret (encrypted with APP_KEY), one waiting for its first
 *   code during setup, when it was turned on, and the last time step used
 *   (a code works once).
 * - login_challenges: the second step of one sign-in, found by a token in an
 *   httpOnly cookie; e-mail codes are kept as an HMAC, attempts are counted.
 * - user_recovery_codes: single-use codes for a lost phone (hashed).
 * - trusted_devices: "Confiar neste dispositivo por 30 dias" (a token in an
 *   httpOnly cookie, hashed here). Sessions remember the trust they came with,
 *   so ending a session ends it too.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.text('two_factor_secret').nullable()
      table.text('two_factor_pending_secret').nullable()
      table.timestamp('two_factor_enabled_at', { useTz: true }).nullable()
      table.bigInteger('two_factor_last_step').nullable()
    })

    this.schema.createTable('login_challenges', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('token_hash', 64).notNullable().unique()
      table.string('method', 10).notNullable()
      table.string('code_hash', 64).nullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.integer('sends').notNullable().defaultTo(0)
      table.timestamp('last_sent_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('consumed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['user_id'])
    })

    this.schema.createTable('user_recovery_codes', (table) => {
      table.increments('id')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('code_hash', 64).notNullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['user_id'])
    })

    this.schema.createTable('trusted_devices', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('token_hash', 64).notNullable().unique()
      table.text('user_agent').nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['user_id'])
    })

    this.schema.alterTable('auth_access_tokens', (table) => {
      table
        .uuid('trusted_device_id')
        .nullable()
        .references('id')
        .inTable('trusted_devices')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('auth_access_tokens', (table) => {
      table.dropColumn('trusted_device_id')
    })
    this.schema.dropTable('trusted_devices')
    this.schema.dropTable('user_recovery_codes')
    this.schema.dropTable('login_challenges')
    this.schema.alterTable('users', (table) => {
      table.dropColumn('two_factor_secret')
      table.dropColumn('two_factor_pending_secret')
      table.dropColumn('two_factor_enabled_at')
      table.dropColumn('two_factor_last_step')
    })
  }
}
