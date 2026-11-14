import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The order history a customer token opens starts at the order that issued
 * it: a phone used before only at the counter (no token yet) must not hand
 * its earlier orders to whoever orders online with it first.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('customers', (table) => {
      table.timestamp('history_since', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('customers', (table) => table.dropColumn('history_since'))
  }
}
