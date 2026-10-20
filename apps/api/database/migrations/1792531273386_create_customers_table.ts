import { BaseSchema } from '@adonisjs/lucid/schema'

/** Menu customers: name + phone per store, no password (not `users`). */
export default class extends BaseSchema {
  protected tableName = 'customers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('store_id').notNullable().references('id').inTable('stores').onDelete('CASCADE')
      table.string('name').notNullable()
      /** Digits only, with country code (e.g. 5511987654321). */
      table.string('phone', 20).notNullable()
      table.timestamps(true, true)

      table.unique(['store_id', 'phone'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
