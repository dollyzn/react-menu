import { BaseSchema } from '@adonisjs/lucid/schema'
import OrderChannel from '#enums/order_channel'
import OrderStatus from '#enums/order_status'
import PaymentMethod from '#enums/payment_method'
import PaymentStatus from '#enums/payment_status'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('orders', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      /** Sequential per store and business day, shown as #12. */
      table.integer('number').notNullable()
      table.date('business_date').notNullable()
      table
        .uuid('customer_id')
        .nullable()
        .references('id')
        .inTable('customers')
        .onDelete('SET NULL')
      table.string('customer_name').notNullable()
      table.string('customer_phone', 20).nullable()
      table.enum('channel', Object.values(OrderChannel)).notNullable()
      table.enum('status', Object.values(OrderStatus)).notNullable()
      table.enum('payment_method', Object.values(PaymentMethod)).notNullable()
      table.enum('payment_status', Object.values(PaymentStatus)).notNullable()
      table.string('mercado_pago_preference_id').nullable()
      table.string('mercado_pago_payment_id').nullable()
      table.decimal('subtotal', 10, 2).notNullable()
      table.decimal('total', 10, 2).notNullable()
      table.text('notes').nullable()
      /** Unguessable id for the customer's public tracking page. */
      table.uuid('public_token').notNullable().unique().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('created_by_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('stock_consumed_at').nullable()
      table.timestamp('ready_at').nullable()
      table.timestamp('completed_at').nullable()
      table.timestamps(true, true)

      table.unique(['store_id', 'business_date', 'number'])
      table.index(['store_id', 'status'])
    })

    this.schema.createTable('order_items', (table) => {
      table.increments('id')
      table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE')
      table.uuid('item_id').nullable().references('id').inTable('items').onDelete('SET NULL')
      table.string('name').notNullable()
      table.decimal('unit_price', 10, 2).notNullable()
      table.integer('quantity').notNullable()
      /** Units the kitchen has finished (0..quantity). */
      table.integer('prepared_quantity').notNullable().defaultTo(0)
      table.boolean('requires_preparation').notNullable().defaultTo(true)
      table.text('notes').nullable()
      table.decimal('total', 10, 2).notNullable()
    })

    this.schema.createTable('order_item_addons', (table) => {
      table.increments('id')
      table
        .integer('order_item_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('order_items')
        .onDelete('CASCADE')
      table.uuid('addon_id').nullable().references('id').inTable('addons').onDelete('SET NULL')
      table.string('name').notNullable()
      table.decimal('unit_price', 10, 2).notNullable()
    })

    this.schema.createTable('order_status_histories', (table) => {
      table.increments('id')
      table.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE')
      table.enum('from_status', Object.values(OrderStatus)).nullable()
      table.enum('to_status', Object.values(OrderStatus)).notNullable()
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.timestamp('created_at').notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('order_status_histories')
    this.schema.dropTable('order_item_addons')
    this.schema.dropTable('order_items')
    this.schema.dropTable('orders')
  }
}
