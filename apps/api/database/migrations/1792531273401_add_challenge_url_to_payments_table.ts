import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * 3-D Secure: when the card's bank asks the payer to confirm, the attempt
 * keeps the challenge URL (shown in an iframe) until it settles.
 */
export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('challenge_url').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('challenge_url')
    })
  }
}
