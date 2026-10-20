import { UserStatusEnum } from '#enums/user_status'
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.string('name').notNullable()
      table.string('email').notNullable().unique()
      table.string('phone').nullable()
      table.string('password').notNullable()
      table.string('avatar_url').nullable()
      table
        .enum('status', Object.values(UserStatusEnum))
        .notNullable()
        .defaultTo(UserStatusEnum.ACTIVE)
      table.boolean('super_user').notNullable().defaultTo(false)
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
