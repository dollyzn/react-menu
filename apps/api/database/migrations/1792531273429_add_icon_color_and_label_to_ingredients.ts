import { BaseSchema } from '@adonisjs/lucid/schema'
import { suggestIngredientIcon } from '#kitchen/ingredient_icons'

/**
 * An ingredient's badge: tile color and short tag ("CAT", "MUS") next to the
 * emoji, so ingredients sharing an emoji are told apart. All three are the
 * manager's picks; null = automatic from the name. Until now the suggested
 * emoji was stored and so never followed a rename: those go back to
 * automatic (an emoji the current name would suggest anyway).
 */
export default class extends BaseSchema {
  protected tableName = 'ingredients'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('icon_color', 16).nullable()
      table.string('icon_label', 3).nullable()
    })

    this.defer(async (db) => {
      const rows: { id: number; name: string; icon: string | null }[] = await db
        .from(this.tableName)
        .whereNotNull('icon')
        .select('id', 'name', 'icon')
      const automatic = rows.filter((row) => row.icon === suggestIngredientIcon(row.name))
      if (automatic.length) {
        await db
          .from(this.tableName)
          .whereIn(
            'id',
            automatic.map((row) => row.id)
          )
          .update({ icon: null })
      }
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('icon_color')
      table.dropColumn('icon_label')
    })
  }
}
