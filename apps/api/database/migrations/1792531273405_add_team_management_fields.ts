import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The team page:
 * - users.email_verified_at: the person proved they read that inbox (invite
 *   or reset link, e-mail sign-in code, Google with a verified address);
 * - users.last_seen_at: last authenticated activity in the panel ("online");
 * - store_user.disabled_at/by: access to one store switched off by its
 *   managers, without removing the person (the role is kept for re-enabling).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.timestamp('email_verified_at', { useTz: true }).nullable()
      table.timestamp('last_seen_at', { useTz: true }).nullable()
    })
    this.schema.alterTable('store_user', (table) => {
      table.timestamp('disabled_at', { useTz: true }).nullable()
      table.uuid('disabled_by').nullable().references('id').inTable('users').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable('store_user', (table) => {
      table.dropColumn('disabled_by')
      table.dropColumn('disabled_at')
    })
    this.schema.alterTable('users', (table) => {
      table.dropColumn('last_seen_at')
      table.dropColumn('email_verified_at')
    })
  }
}
