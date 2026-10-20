import { BaseSchema } from '@adonisjs/lucid/schema'

/** Ingredients consumed by one unit of an item or of an add-on. */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('item_ingredients', (table) => {
      table.uuid('item_id').notNullable().references('id').inTable('items').onDelete('CASCADE')
      table
        .integer('ingredient_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ingredients')
        .onDelete('CASCADE')
      table.decimal('quantity', 12, 3).notNullable()
      table.primary(['item_id', 'ingredient_id'])
    })

    this.schema.createTable('addon_ingredients', (table) => {
      table.uuid('addon_id').notNullable().references('id').inTable('addons').onDelete('CASCADE')
      table
        .integer('ingredient_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('ingredients')
        .onDelete('CASCADE')
      table.decimal('quantity', 12, 3).notNullable()
      table.primary(['addon_id', 'ingredient_id'])
    })
  }

  async down() {
    this.schema.dropTable('addon_ingredients')
    this.schema.dropTable('item_ingredients')
  }
}
