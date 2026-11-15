import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * "Pagar depois" (fiado): a counter order the customer settles another day.
 * Handed over without a payment; the managers follow it until it is received.
 */
export default class extends BaseSchema {
  protected tableName = 'orders'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('pay_later_at', { useTz: true }).nullable()
      table
        .uuid('pay_later_by_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      // The managers' "Pagar depois" list: open ones per store.
      table.index(['store_id', 'pay_later_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['store_id', 'pay_later_at'])
      table.dropColumn('pay_later_by_id')
      table.dropColumn('pay_later_at')
    })
  }
}
