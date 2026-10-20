import { BaseSchema } from '@adonisjs/lucid/schema'
import StockMovementType from '#enums/stock_movement_type'

export default class extends BaseSchema {
  protected tableName = 'stock_movements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table
        .integer('ingredient_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ingredients')
        .onDelete('CASCADE')
      table.enum('type', Object.values(StockMovementType)).notNullable()
      /** Signed: positive adds stock, negative removes it. */
      table.decimal('quantity', 12, 3).notNullable()
      table.uuid('order_id').nullable().references('id').inTable('orders').onDelete('SET NULL')
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.text('note').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['ingredient_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
