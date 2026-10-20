import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_social_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('provider').notNullable()
      table.string('provider_user_id').notNullable()
      table.text('access_token').notNullable()
      table.text('refresh_token').nullable()
      table.timestamp('expires_at').nullable()
      table.timestamps(true, true)

      table.unique(['provider', 'provider_user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
