import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'customers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /**
       * SHA-256 of the customer's history token: devices holding the token
       * see all of the customer's orders (sync via link). Never the token.
       */
      table.string('access_token_hash', 64).nullable().unique()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('access_token_hash')
    })
  }
}
