import { BaseSchema } from '@adonisjs/lucid/schema'
import { suggestIngredientIcon } from '#kitchen/ingredient_icons'

export default class extends BaseSchema {
  protected tableName = 'ingredients'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      /** Emoji shown in the kitchen for quick recognition. */
      table.string('icon', 16).nullable()
    })

    // Existing ingredients get the suggested icon.
    this.defer(async (db) => {
      const rows: { id: number; name: string }[] = await db
        .from(this.tableName)
        .select('id', 'name')
      for (const row of rows) {
        const icon = suggestIngredientIcon(row.name)
        if (icon) await db.from(this.tableName).where('id', row.id).update({ icon })
      }
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('icon')
    })
  }
}
