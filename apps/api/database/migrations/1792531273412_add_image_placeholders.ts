import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A tiny blurred copy of each uploaded image (a WebP data URL, a few hundred
 * bytes), shown by the web while the real image loads. Null: none yet
 * (`node ace images:blur` fills existing ones).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('items', (table) => table.text('photo_blur').nullable())
    this.schema.alterTable('stores', (table) => {
      table.text('banner_blur').nullable()
      table.text('photo_blur').nullable()
    })
    this.schema.alterTable('users', (table) => table.text('avatar_blur').nullable())
  }

  async down() {
    this.schema.alterTable('items', (table) => table.dropColumn('photo_blur'))
    this.schema.alterTable('stores', (table) => {
      table.dropColumn('banner_blur')
      table.dropColumn('photo_blur')
    })
    this.schema.alterTable('users', (table) => table.dropColumn('avatar_blur'))
  }
}
