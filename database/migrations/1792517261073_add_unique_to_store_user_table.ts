import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'store_user'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`
        DELETE FROM ${this.tableName} a
        USING ${this.tableName} b
        WHERE a.id > b.id
          AND a.user_id = b.user_id
          AND a.store_id = b.store_id
      `)
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['user_id', 'store_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['user_id', 'store_id'])
    })
  }
}
