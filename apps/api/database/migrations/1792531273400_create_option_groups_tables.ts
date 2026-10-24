import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Choice groups ("Escolha o queijo", "Molhos: até 2"): a set of the store's
 * add-ons with a minimum and maximum number of choices, attached to items.
 * Options are add-ons, so their price, recipe and stock keep working.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('option_groups', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.string('name', 120).notNullable()
      table.integer('min_choices').notNullable().defaultTo(0)
      table.integer('max_choices').notNullable().defaultTo(1)
      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
      table.index(['store_id'])
    })
    this.schema.createTable('option_group_addons', (table) => {
      table
        .uuid('option_group_id')
        .notNullable()
        .references('id')
        .inTable('option_groups')
        .onDelete('CASCADE')
      table.uuid('addon_id').notNullable().references('id').inTable('addons').onDelete('CASCADE')
      table.integer('order').notNullable().defaultTo(0)
      table.primary(['option_group_id', 'addon_id'])
    })
    this.schema.createTable('item_option_groups', (table) => {
      table.uuid('item_id').notNullable().references('id').inTable('items').onDelete('CASCADE')
      table
        .uuid('option_group_id')
        .notNullable()
        .references('id')
        .inTable('option_groups')
        .onDelete('CASCADE')
      table.integer('order').notNullable().defaultTo(0)
      table.primary(['item_id', 'option_group_id'])
    })
  }

  async down() {
    this.schema.dropTable('item_option_groups')
    this.schema.dropTable('option_group_addons')
    this.schema.dropTable('option_groups')
  }
}
