import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A choice group can put its pick in the item's name on the staff screens
 * ("Escolha o queijo" replaces "Queijo": "Frango com Catupiry"). The name is
 * worked out when the order is placed and kept with the line, like its
 * name and prices.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('option_groups', (table) => {
      table.string('replaces_in_name', 40).nullable()
    })
    this.schema.alterTable('order_items', (table) => {
      table.string('display_name').nullable()
    })
  }

  async down() {
    this.schema.alterTable('order_items', (table) => table.dropColumn('display_name'))
    this.schema.alterTable('option_groups', (table) => table.dropColumn('replaces_in_name'))
  }
}
