import { BaseSchema } from '@adonisjs/lucid/schema'
import PaymentMethod from '#enums/payment_method'

/**
 * In-app checkout (ADR 0015): payment attempts per order, the store's public
 * key for the card form, and the new payment methods on orders.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('payments', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE')
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      /** Which gateway processed it (mercado_pago, fake in development). */
      table.string('gateway', 30).notNullable()
      table.string('method', 20).notNullable()
      table.string('gateway_payment_id').nullable()
      table.string('status', 20).notNullable()
      table.string('status_detail').nullable()
      table.decimal('amount', 10, 2).notNullable()
      table.text('pix_qr_code').nullable()
      table.text('pix_ticket_url').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamps(true, true)

      table.unique(['gateway', 'gateway_payment_id'])
      table.index(['order_id', 'created_at'])
    })

    this.schema.alterTable('stores', (table) => {
      /** Public by design: the card form in the browser needs it. */
      table.string('mercado_pago_public_key').nullable()
    })

    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check')
    this.schema.raw(
      `ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN (${Object.values(
        PaymentMethod
      )
        .map((method) => `'${method}'`)
        .join(', ')}))`
    )
  }

  async down() {
    this.schema.raw('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check')
    this.schema.raw(
      "ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('mercado_pago', 'counter'))"
    )
    this.schema.alterTable('stores', (table) => {
      table.dropColumn('mercado_pago_public_key')
    })
    this.schema.dropTable('payments')
  }
}
