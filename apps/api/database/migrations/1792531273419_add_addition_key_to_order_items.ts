import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The Idempotency-Key of the request that added a line to an order in the
 * queue (like `orders.idempotency_key` for new orders): a retry after a lost
 * answer finds the lines already added instead of adding them twice, even
 * when the replay cache no longer has the response.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('order_items', (table) => {
      table.string('addition_key').nullable()
      table.index(['order_id', 'addition_key'])
    })
  }

  async down() {
    this.schema.alterTable('order_items', (table) => {
      table.dropIndex(['order_id', 'addition_key'])
      table.dropColumn('addition_key')
    })
  }
}
