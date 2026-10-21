import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Staff created by an invite who haven't set a password or signed in yet:
 * the team page shows them as pending and can resend the invite.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('invite_pending').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('invite_pending')
    })
  }
}
