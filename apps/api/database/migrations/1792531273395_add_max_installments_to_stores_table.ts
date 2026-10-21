import { BaseSchema } from '@adonisjs/lucid/schema'

/** Card installments offered at checkout (1 = à vista only). */
export default class extends BaseSchema {
  protected tableName = 'stores'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('max_installments').notNullable().defaultTo(1)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('max_installments')
    })
  }
}
