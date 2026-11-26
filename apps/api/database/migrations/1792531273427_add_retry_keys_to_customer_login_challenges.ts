import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A customer's sign-in is safe to repeat with the same Idempotency-Key
 * (ADR 0013): its answers carry secrets, so the middleware never replays
 * them, and the challenge keeps the keys instead (SHA-256 only).
 *
 * - start_key_hash: starting again with the same key returns the same
 *   challenge (a fresh secret) instead of sending another paid code.
 * - claim_key_hash + session_id: claiming again with the same key, after an
 *   answer that got lost, hands out that session again (a fresh token).
 */
export default class extends BaseSchema {
  protected tableName = 'customer_login_challenges'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('start_key_hash', 64).nullable()
      table.string('claim_key_hash', 64).nullable()
      table
        .uuid('session_id')
        .nullable()
        .references('id')
        .inTable('customer_sessions')
        .onDelete('SET NULL')
      table.unique(['store_id', 'start_key_hash'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['store_id', 'start_key_hash'])
      table.dropColumn('session_id')
      table.dropColumn('claim_key_hash')
      table.dropColumn('start_key_hash')
    })
  }
}
