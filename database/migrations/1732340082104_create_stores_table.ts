import { BaseSchema } from '@adonisjs/lucid/schema'
import StoreStatus from '../../app/enums/store-status.js'

export default class extends BaseSchema {
  protected tableName = 'stores'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('uuid_generate_v4()'))
      table.string('name').notNullable()
      table.enum('status', Object.values(StoreStatus)).defaultTo(StoreStatus.CLOSED).notNullable()
      table.string('address').nullable()
      table.string('instagram_url').nullable()
      table.string('ifood_url').nullable()
      table.string('banner_url').nullable()
      table.string('photo_url').nullable()
      table.string('slug').notNullable().unique()
      table.boolean('is_default').notNullable().defaultTo(false)
      table.timestamps(true, true)
    })

    this.schema.raw(`
      CREATE UNIQUE INDEX unique_is_default_store ON ${this.tableName} ("is_default")
      WHERE "is_default" = true;
    `)
  }

  public async down() {
    this.schema.raw(`DROP INDEX IF EXISTS unique_is_default_store`)
    this.schema.dropTable(this.tableName)
  }
}
