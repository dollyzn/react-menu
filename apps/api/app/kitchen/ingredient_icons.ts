/**
 * Emoji that help the kitchen recognize an ingredient at a glance. Used as
 * the default when a manager doesn't pick one, and as a fallback in the
 * kitchen queue. Specific keywords come first ("carne seca" before "carne").
 */
const KEYWORDS: [RegExp, string][] = [
  // Drinks first: "Suco de Goiaba" is a juice, not guava paste.
  [/suco|nectar/, '🧃'],
  [/agua/, '💧'],
  [/refrigerante|coca|guarana|fanta|sprite|schweppes|h2o|guaraviton|soda/, '🥤'],
  // Before meats: "pimenta calabresa" is a spice, not sausage.
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

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function suggestIngredientIcon(name: string): string | null {
  const normalized = normalize(name)
  return KEYWORDS.find(([pattern]) => pattern.test(normalized))?.[1] ?? null
}
