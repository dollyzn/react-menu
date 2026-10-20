import { BaseSchema } from '@adonisjs/lucid/schema'
import StoreRole from '#enums/store_role'

export default class extends BaseSchema {
  protected tableName = 'store_user'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('role', Object.values(StoreRole)).notNullable().defaultTo(StoreRole.MANAGER)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('role')
    })
  }
}
