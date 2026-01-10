import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('tokenable_id').notNullable().references('users.id').onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name')
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('last_used_at')
      table.timestamp('expires_at')
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
