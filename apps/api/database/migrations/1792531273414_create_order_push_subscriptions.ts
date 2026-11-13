import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A customer's browser (Firebase Installation ID) waiting for "seu pedido
 * está pronto" on one order. No account: the tracking page's token is the
 * key. `orders.ready_notified_at` keeps the notice to once per "ready".
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('order_push_subscriptions', (table) => {
      table.increments('id')
      table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE')
      table.string('fid').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.unique(['order_id', 'fid'])
    })
    this.schema.alterTable('orders', (table) => {
      table.timestamp('ready_notified_at', { useTz: true }).nullable()
    })
  }

  async down() {
    this.schema.alterTable('orders', (table) => table.dropColumn('ready_notified_at'))
    this.schema.dropTable('order_push_subscriptions')
  }
}
