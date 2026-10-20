import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'addon_item'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('item_id').references('id').inTable('items').onDelete('CASCADE')
      table.uuid('addon_id').references('id').inTable('addons').onDelete('CASCADE')
      table.primary(['item_id', 'addon_id'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}
