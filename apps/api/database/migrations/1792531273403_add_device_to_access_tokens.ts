import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * What the "Sessões ativas" list shows about each session: the browser it
 * came from, its IP, and when it signed in (kept when a sliding renewal
 * swaps the token, so the list says "since" the real sign-in).
 */
export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('user_agent').nullable()
      table.string('ip_address', 45).nullable()
      table.timestamp('signed_in_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('user_agent')
      table.dropColumn('ip_address')
      table.dropColumn('signed_in_at')
    })
  }
}
