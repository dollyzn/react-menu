import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Price by the order of the pick ("Recheio extra": the 1st R$ 3, the others
 * R$ 5 each): [3, 5] prices the 1st pick 3 and every later one 5 (the last
 * value repeats). Null: each option's own price in the group.
 */
export default class extends BaseSchema {
  protected tableName = 'option_groups'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.jsonb('pick_prices').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pick_prices')
    })
  }
}
