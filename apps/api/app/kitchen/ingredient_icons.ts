import type { IngredientBadge, IngredientIconColor } from '@react-menu/contracts'

/** Tile colors a manager can pick (the web maps each to its classes). */
export const INGREDIENT_ICON_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'sky',
  'blue',
  'violet',
  'pink',
] as const satisfies readonly IngredientIconColor[]

/**
 * How the kitchen recognizes an ingredient at a glance: emoji, tile color
 * and, where several ingredients share an emoji (cheeses, cured meats), a
 * short tag that tells them apart. Used whenever the manager left a part on
 * "automatic". Specific keywords come first ("carne seca" before "carne").
 * Every emoji here is also in the web's picker (`ingredient-icon-catalog.ts`).
 */
const KEYWORDS: [RegExp, string, IngredientIconColor, string?][] = [
  // Drinks first: "Suco de Goiaba" is a juice, not guava paste.
  [/suco|nectar/, '🧃', 'orange'],
  [/agua/, '💧', 'sky'],
  [/cerveja|chopp/, '🍺', 'amber'],
  [/vinho/, '🍷', 'violet'],
  [/cafe/, '☕', 'amber'],
  [/\bcha\b/, '🍵', 'green'],
  [/refrigerante|coca|guarana|fanta|sprite|schweppes|h2o|guaraviton|soda/, '🥤', 'red'],
  [/gelo/, '🧊', 'sky'],
  // Before meats: "pimenta calabresa" is a spice, not sausage.
  [/pimentao/, '🫑', 'green'],
  [/pimenta/, '🌶️', 'red'],
  [/camarao/, '🦐', 'orange'],
  [/lula/, '🦑', 'pink'],
  [/polvo/, '🐙', 'violet'],
  [/siri|caranguejo/, '🦀', 'red'],
  [/salmao/, '🐟', 'orange', 'SAL'],
  [/bacalhau/, '🐟', 'gray', 'BAC'],
  [/atum/, '🐟', 'blue', 'ATU'],
  [/peixe|tilapia/, '🐟', 'sky'],
  [/carne seca|charque/, '🥩', 'orange', 'SEC'],
  [/costela/, '🍖', 'orange', 'COS'],
  [/cupim/, '🍖', 'amber', 'CUP'],
  [/hamburguer|burger/, '🍔', 'amber'],
  [/carne|patinho|picanha|acem/, '🥩', 'red'],
  [/frango|galinha/, '🍗', 'amber'],
  [/calabresa/, '🌭', 'red', 'CAL'],
  [/salsicha/, '🌭', 'pink', 'SAL'],
  [/linguica/, '🌭', 'orange'],
  [/bacon/, '🥓', 'red'],
  [/peito de peru/, '🍖', 'pink', 'PER'],
  [/presunto/, '🍖', 'pink', 'PRE'],
  [/lombo/, '🍖', 'red', 'LOM'],
  [/catupiry/, '🧀', 'sky', 'CAT'],
  [/requeijao/, '🧀', 'teal', 'REQ'],
  [/cream cheese/, '🧀', 'blue', 'CRC'],
  [/cheddar/, '🧀', 'orange', 'CHE'],
  [/parmesao/, '🧀', 'amber', 'PAR'],
  [/provolone/, '🧀', 'lime', 'PRO'],
  [/gorgonzola/, '🧀', 'green', 'GOR'],
  [/coalho/, '🧀', 'gray', 'COA'],
  [/mussarela|mucarela/, '🧀', 'yellow', 'MUS'],
  [/queijo/, '🧀', 'yellow'],
  [/manteiga|margarina/, '🧈', 'yellow'],
  [/ovo/, '🥚', 'amber'],
  [/milho/, '🌽', 'yellow'],
  [/tomate/, '🍅', 'red'],
  [/azeitona/, '🫒', 'lime'],
  [/brocolis/, '🥦', 'green'],
  [/escarola|alface|espinafre|rucula|couve|repolho/, '🥬', 'green'],
  [/palmito/, '🌴', 'lime'],
  [/beringela|berinjela/, '🍆', 'violet'],
  [/cebola/, '🧅', 'violet'],
  [/alho/, '🧄', 'gray'],
  [/gengibre/, '🫚', 'amber'],
  [/batata frita|fritas/, '🍟', 'yellow'],
  [/batata doce/, '🍠', 'orange'],
  [/batata/, '🥔', 'amber'],
  [/mandioca|aipim/, '🥔', 'orange', 'MAN'],
  [/cenoura/, '🥕', 'orange'],
  [/pepino|picles/, '🥒', 'green'],
  [/ervilha/, '🫛', 'lime'],
  [/feijao/, '🫘', 'red'],
  [/arroz/, '🍚', 'gray'],
  [/cogumelo|champignon|shimeji|shitake/, '🍄', 'amber'],
  [/oregano|manjericao|salsinha|cheiro verde|ervas|cebolinha|coentro/, '🌿', 'green'],
  [/\bsal\b/, '🧂', 'gray'],
  [/ketchup/, '🥫', 'red', 'KET'],
  [/mostarda/, '🥫', 'yellow', 'MOS'],
  [/maionese/, '🥫', 'gray', 'MAI'],
  [/molho/, '🥫', 'red'],
  [/oleo|azeite/, '🫙', 'yellow'],
  [/chocolate branco/, '🤍', 'gray'],
  [/nutella|creme de avela/, '🍫', 'amber', 'NUT'],
  [/brigadeiro/, '🍫', 'pink', 'BRI'],
  [/chocolate|kitkat|cacau/, '🍫', 'amber'],
  [/doce de leite/, '🍯', 'amber'],
  [/\bmel\b/, '🍯', 'yellow'],
  [/leite condensado/, '🥛', 'yellow', 'CON'],
  [/creme de leite/, '🥛', 'sky', 'CRE'],
  [/leite/, '🥛', 'gray'],
  [/sorvete/, '🍨', 'pink'],
  [/goiabada|goiaba/, '🍬', 'red', 'GOI'],
  [/banana/, '🍌', 'yellow'],
  [/morango/, '🍓', 'red'],
  [/coco/, '🥥', 'gray'],
  [/abacaxi/, '🍍', 'yellow'],
  [/limao/, '🍋', 'lime'],
  [/laranja/, '🍊', 'orange'],
  [/maca/, '🍎', 'red'],
  [/uva/, '🍇', 'violet'],
  [/manga/, '🥭', 'orange'],
  [/maracuja/, '🍈', 'yellow'],
  [/acai|mirtilo/, '🫐', 'violet'],
  [/abacate/, '🥑', 'green'],
  [/amendoim|pacoca/, '🥜', 'amber'],
  [/castanha|nozes/, '🌰', 'orange'],
  [/canela/, '🍬', 'orange', 'CAN'],
  [/acucar/, '🍬', 'gray', 'AÇU'],
  [/pao/, '🍞', 'amber'],
  [/embalagem|caixa|sacola/, '📦', 'gray'],
  [/guardanapo/, '🧻', 'gray'],
  [/massa|pastel/, '🥟', 'amber'],
]

/** Colors for names no keyword knows: stable per name, so neighbors differ. */
const FALLBACK_COLORS = INGREDIENT_ICON_COLORS.filter((color) => color !== 'gray')

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function hashColor(name: string): IngredientIconColor {
  let hash = 0
  for (const char of normalize(name).trim()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

/** The automatic badge for a name. */
export function suggestIngredientBadge(name: string): IngredientBadge {
  const normalized = normalize(name)
  const match = KEYWORDS.find(([pattern]) => pattern.test(normalized))
  if (!match) return { emoji: null, color: hashColor(name), label: null }
  const [, emoji, color, label] = match
  return { emoji, color, label: label ?? null }
}

export function suggestIngredientIcon(name: string): string | null {
  return suggestIngredientBadge(name).emoji
}

/**
 * The manager's picks over the automatic badge. `null` = automatic (follows
 * the name, renames included); a label of `false` (or "", as stored) = no tag.
 */
export function ingredientBadge(
  name: string,
  picks: { icon: string | null; iconColor: string | null; iconLabel: string | false | null }
): IngredientBadge {
  const auto = suggestIngredientBadge(name)
  return {
    emoji: picks.icon ?? auto.emoji,
    color: (picks.iconColor as IngredientIconColor | null) ?? auto.color,
    label: picks.iconLabel === null ? auto.label : picks.iconLabel || null,
  }
}
