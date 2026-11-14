import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * An order can be paid in more than one go: items added while it waits in
 * the queue are charged on their own (cash first, a drink on Pix later).
 * Every amount received is a receipt; `orders.amount_paid` is their sum and
 * the order is paid when it covers the total. Orders paid before this get
 * one receipt for their total.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('order_receipts', (table) => {
      table.increments('id')
      table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE')
      table.decimal('amount', 10, 2).notNullable()
      // How: the order's payment method (counter, pix, card, point…), and at
      // the counter how the cashier took it.
      table.string('payment_method').notNullable()
      table.string('counter_method').nullable()
      // The gateway attempt that paid it (online or the card machine).
      table
        .uuid('payment_id')
        .nullable()
        .unique()
        .references('id')
        .inTable('payments')
        .onDelete('SET NULL')
      table.uuid('received_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('received_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['order_id'])
    })

    this.schema.alterTable('orders', (table) => {
      table.decimal('amount_paid', 10, 2).notNullable().defaultTo(0)
    })

    // Lines added while the order waited in the queue (null: placed with it).
    this.schema.alterTable('order_items', (table) => {
      table.timestamp('added_at', { useTz: true }).nullable()
      table.uuid('added_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        insert into order_receipts
          (order_id, amount, payment_method, counter_method, payment_id, received_by_id, received_at, created_at)
        select o.id, o.total, o.payment_method, o.counter_method,
          (select p.id from payments p
            where p.order_id = o.id
              and p.status in ('approved', 'refunded')
              and p.gateway_payment_id = o.mercado_pago_payment_id
            order by p.created_at limit 1),
          o.paid_by_id, coalesce(o.paid_at, o.updated_at), now()
        from orders o
        where o.payment_status in ('paid', 'refunded')
      `)
      await db.rawQuery(
        `update orders set amount_paid = total where payment_status in ('paid', 'refunded')`
      )
    })
  }

  async down() {
    this.schema.alterTable('order_items', (table) => {
      table.dropColumn('added_by_id')
      table.dropColumn('added_at')
    })
    this.schema.alterTable('orders', (table) => table.dropColumn('amount_paid'))
    this.schema.dropTable('order_receipts')
  }
}
