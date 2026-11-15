import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Card machine: a POS order charged on it reaches the kitchen only once the
 * machine approves (off: at once, as before).
 */
export default class extends BaseSchema {
  protected tableName = 'stores'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('point_kitchen_after_payment').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('point_kitchen_after_payment')
    })
  }
}
