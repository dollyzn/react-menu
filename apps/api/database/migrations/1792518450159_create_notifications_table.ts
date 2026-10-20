import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'notifications'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('store_id').nullable().references('id').inTable('stores').onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('category').notNullable()
      table.string('title').notNullable()
      table.text('body').notNullable()
      table.string('url').nullable()
      table.jsonb('data').notNullable().defaultTo('{}')
      table.timestamp('read_at').nullable()
      table.timestamps(true, true)

      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
