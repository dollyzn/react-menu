import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A group may let the same option be picked more than once ("Escolha 2
 * sabores": queijo twice = 8 minis of cheese). Off by default.
 */
export default class extends BaseSchema {
  protected tableName = 'option_groups'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('allow_repeat').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('allow_repeat')
    })
  }
}
