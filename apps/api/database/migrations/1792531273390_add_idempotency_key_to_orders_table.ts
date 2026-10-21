import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /**
       * Client-generated key of the request that created the order. A retry
       * with the same key returns this order instead of creating another.
       */
      table.string('idempotency_key', 128).nullable()
      table.unique(['store_id', 'idempotency_key'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['store_id', 'idempotency_key'])
      table.dropColumn('idempotency_key')
    })
  }
}
