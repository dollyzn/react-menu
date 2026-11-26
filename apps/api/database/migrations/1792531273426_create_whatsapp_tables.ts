import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * WhatsApp Cloud API per store (ADR 0025).
 *
 * - whatsapp_accounts: the store's number connected through Embedded Signup
 *   (one per store): its WABA, phone number id, the business token and the
 *   registration PIN (both encrypted with APP_KEY), the store's switches and
 *   the last known state of our templates (polled: their webhook goes to the
 *   app's default callback, not ours).
 * - whatsapp_messages: every message we send (order notices, login replies),
 *   once per `dedup_key`; status webhooks update it by `wamid`.
 * - customer_login_challenges: a customer proving their phone to see their
 *   history, by sending us a code (inbound) or typing one we sent (code).
 * - customer_sessions: the history session of a verified phone in a store
 *   (only the token's SHA-256), replacing ADR 0014's customer token.
 * - orders.whatsapp_opt_in: the customer asked for notices at checkout.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('whatsapp_accounts', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table
        .uuid('store_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('stores')
        .onDelete('CASCADE')
      table.string('waba_id', 40).notNullable()
      table.string('phone_number_id', 40).notNullable().unique()
      table.string('business_id', 40).nullable()
      table.string('display_phone_number', 30).notNullable()
      table.string('verified_name').nullable()
      table.text('access_token').notNullable()
      table.text('register_pin').nullable()
      /** A WhatsApp Business app number (coexistence): never registered by us. */
      table.boolean('coexistence').notNullable().defaultTo(false)
      table.boolean('notify_orders').notNullable().defaultTo(true)
      table.boolean('customer_login').notNullable().defaultTo(true)
      table.jsonb('templates').notNullable().defaultTo('{}')
      table.timestamp('templates_checked_at', { useTz: true }).nullable()
      table.timestamp('webhook_subscribed_at', { useTz: true }).nullable()
      /** Meta refused a message for the WABA's payment method (131042). */
      table.timestamp('payment_issue_at', { useTz: true }).nullable()
      /** The token stopped working (190) or the number was removed. */
      table.timestamp('broken_at', { useTz: true }).nullable()
      table.text('last_error').nullable()
      table
        .uuid('connected_by_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.timestamps(true, true)
    })

    this.schema.createTable('whatsapp_messages', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.uuid('order_id').nullable().references('id').inTable('orders').onDelete('CASCADE')
      table.string('kind', 30).notNullable()
      table.string('dedup_key', 120).notNullable().unique()
      table.string('to', 20).notNullable()
      /** What to send: a template with its parameters, or a text. */
      table.jsonb('content').notNullable()
      table.string('wamid', 128).nullable().unique()
      table.string('status', 12).notNullable().defaultTo('queued')
      table.integer('error_code').nullable()
      table.text('error_title').nullable()
      table.timestamp('sent_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['store_id', 'created_at'])
      table.index(['order_id'])
    })

    this.schema.createTable('customer_login_challenges', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.string('method', 10).notNullable()
      /** Inbound: the code the customer sends us (short-lived, shown on screen). */
      table.string('code', 12).nullable()
      /** Code: HMAC of the code we sent. */
      table.string('code_hash', 64).nullable()
      /** The browser that started it claims the session with this secret. */
      table.string('secret_hash', 64).notNullable()
      table.string('phone', 20).nullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('verified_at', { useTz: true }).nullable()
      table.timestamp('claimed_at', { useTz: true }).nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['store_id', 'code'])
      table.index(['store_id', 'phone', 'created_at'])
    })

    this.schema.createTable('customer_sessions', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      /** Digits with country code, as normalizeBrazilianPhone writes it. */
      table.string('phone', 20).notNullable()
      table.string('token_hash', 64).notNullable().unique()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['store_id', 'phone'])
    })

    this.schema.alterTable('orders', (table) => {
      table.boolean('whatsapp_opt_in').notNullable().defaultTo(false)
    })

    // ADR 0014's device token is replaced by phone-verified sessions.
    this.schema.alterTable('customers', (table) => {
      table.dropColumn('access_token_hash')
      table.dropColumn('history_since')
    })
  }

  async down() {
    this.schema.alterTable('customers', (table) => {
      table.string('access_token_hash', 64).nullable().unique()
      table.timestamp('history_since', { useTz: true }).nullable()
    })
    this.schema.alterTable('orders', (table) => table.dropColumn('whatsapp_opt_in'))
    this.schema.dropTable('customer_sessions')
    this.schema.dropTable('customer_login_challenges')
    this.schema.dropTable('whatsapp_messages')
    this.schema.dropTable('whatsapp_accounts')
  }
}
