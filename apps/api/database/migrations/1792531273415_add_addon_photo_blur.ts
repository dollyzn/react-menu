import { BaseSchema } from '@adonisjs/lucid/schema'

/** Add-on photos get the same blurred preview as items' (see 1792531273412). */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('addons', (table) => table.text('photo_blur').nullable())
  }

  async down() {
    this.schema.alterTable('addons', (table) => table.dropColumn('photo_blur'))
  }
}
