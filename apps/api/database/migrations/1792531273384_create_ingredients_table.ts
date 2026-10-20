import { BaseSchema } from '@adonisjs/lucid/schema'
import IngredientUnit from '#enums/ingredient_unit'

export default class extends BaseSchema {
  protected tableName = 'ingredients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.string('name').notNullable()
      table.enum('unit', Object.values(IngredientUnit)).notNullable()
      table.decimal('stock_quantity', 12, 3).notNullable().defaultTo(0)
      table.decimal('min_stock', 12, 3).notNullable().defaultTo(0)
      table.timestamps(true, true)

      table.unique(['store_id', 'name'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
