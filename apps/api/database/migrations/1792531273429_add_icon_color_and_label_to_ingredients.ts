import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The keywords that filled `ingredients.icon` until now, frozen here: the
 * app's list (#kitchen/ingredient_icons) keeps changing, and this migration
 * must do the same thing on every database.
 */
const SAVED_KEYWORDS: [RegExp, string][] = [
  [/suco|nectar/, '🧃'],
  [/agua/, '💧'],
  [/refrigerante|coca|guarana|fanta|sprite|schweppes|h2o|guaraviton|soda/, '🥤'],
  [/pimentao/, '🫑'],
  [/pimenta/, '🌶️'],
  [/camarao/, '🦐'],
  [/salmao|bacalhau|atum|peixe/, '🐟'],
  [/carne seca|charque/, '🥩'],
  [/costela|cupim/, '🍖'],
  [/carne|patinho|picanha/, '🥩'],
  [/frango|galinha/, '🍗'],
  [/calabresa|linguica|salsicha/, '🌭'],
  [/bacon/, '🥓'],
  [/presunto|peito de peru|lombo/, '🍖'],
  [
    /catupiry|requeijao|cream cheese|cheddar|parmesao|mussarela|mucarela|provolone|gorgonzola|queijo/,
    '🧀',
  ],
  [/ovo/, '🥚'],
  [/milho/, '🌽'],
  [/tomate/, '🍅'],
  [/azeitona/, '🫒'],
  [/brocolis/, '🥦'],
  [/escarola|alface|espinafre|rucula|couve/, '🥬'],
  [/palmito/, '🌴'],
  [/beringela|berinjela/, '🍆'],
  [/cebola/, '🧅'],
  [/alho/, '🧄'],
  [/cogumelo|champignon|shimeji/, '🍄'],
  [/oregano|manjericao|salsinha|cheiro verde|ervas/, '🌿'],
  [/molho/, '🥫'],
  [/chocolate branco/, '🤍'],
  [/chocolate|nutella|kitkat|brigadeiro|cacau/, '🍫'],
  [/doce de leite|mel/, '🍯'],
  [/leite condensado|leite/, '🥛'],
  [/goiabada|goiaba/, '🍬'],
  [/banana/, '🍌'],
  [/morango/, '🍓'],
  [/coco/, '🥥'],
  [/abacaxi/, '🍍'],
  [/canela|acucar/, '🍬'],
  [/massa|pastel/, '🥟'],
]

function savedSuggestion(name: string) {
  const normalized = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  return SAVED_KEYWORDS.find(([pattern]) => pattern.test(normalized))?.[1] ?? null
}

/**
 * An ingredient's badge: tile color and short tag ("CAT", "MUS") next to the
 * emoji, so ingredients sharing an emoji are told apart. All three are the
 * manager's picks; null = automatic from the name. Until now the suggested
 * emoji was stored and so never followed a rename: an icon equal to what the
 * name suggested when it was saved goes back to automatic.
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
      const automatic = rows.filter((row) => row.icon === savedSuggestion(row.name))
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

    // The code before this migration read `icon` as stored: fill it again.
    this.defer(async (db) => {
      const rows: { id: number; name: string }[] = await db
        .from(this.tableName)
        .whereNull('icon')
        .select('id', 'name')
      for (const row of rows) {
        const icon = savedSuggestion(row.name)
        if (icon) await db.from(this.tableName).where('id', row.id).update({ icon })
      }
    })
  }
}
