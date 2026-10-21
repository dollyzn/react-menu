import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'stores'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /**
       * Kitchen batching: identical pastries from up to this many later orders
       * are made together with the oldest one. 0 = strict arrival order.
       */
      table.integer('kitchen_batch_lookahead').notNullable().defaultTo(3)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('kitchen_batch_lookahead')
    })
  }
}
