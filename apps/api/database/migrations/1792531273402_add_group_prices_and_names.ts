import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Choice groups can price their options ("Recheio extra": R$ 4 each, the same
 * add-on free in "Troque o recheio"); null keeps the add-on's own price.
 * Order lines remember which group a choice came from ("Recheio extra:
 * Carne" on the ticket and in the kitchen).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('option_group_addons', (table) => {
      table.decimal('price', 10, 2).nullable()
    })
    this.schema.alterTable('order_item_addons', (table) => {
      table.string('group_name', 120).nullable()
    })
  }

  async down() {
    this.schema.alterTable('order_item_addons', (table) => {
      table.dropColumn('group_name')
    })
    this.schema.alterTable('option_group_addons', (table) => {
      table.dropColumn('price')
    })
  }
}
