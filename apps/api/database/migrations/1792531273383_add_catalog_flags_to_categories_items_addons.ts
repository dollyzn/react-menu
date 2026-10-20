import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('categories', (table) => {
      /** Drinks and ready-made products skip the kitchen. */
      table.boolean('requires_preparation').notNullable().defaultTo(true)
    })
    this.schema.alterTable('items', (table) => {
      /** Manual "sold out" switch, independent of stock. */
      table.boolean('is_available').notNullable().defaultTo(true)
    })
    this.schema.alterTable('addons', (table) => {
      table.boolean('is_available').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable('categories', (table) => table.dropColumn('requires_preparation'))
    this.schema.alterTable('items', (table) => table.dropColumn('is_available'))
    this.schema.alterTable('addons', (table) => table.dropColumn('is_available'))
  }
}
