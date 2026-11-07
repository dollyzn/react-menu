import IngredientUnit from '#enums/ingredient_unit'
import type { Catalog, CatalogItem, CatalogStoreProfile } from '#catalog/types'

/**
 * The JJ Pastéis menu, choice groups, add-ons and stock, as specified by the
 * store on 2026-11-06 ("Especificação inicial do cardápio digital"). Loaded
 * into a store by `node ace jj:setup` (production, once) and by the demo
 * seeder (development, tests).
 *
 * Quantities are the kitchen's rough portions (the store said deduction
 * doesn't need to be exact): 80 g of the main filling, 40 g of a second one
 * or of an extra, one dough per pastry. Adjust them in the panel.
 */

const G = IngredientUnit.GRAM
const U = IngredientUnit.UNIT

/** Main filling, a second filling, an extra/cheese portion (grams). */
const MAIN = 80
const SECOND = 40
const EXTRA = 40
/** Each flavor of a mini pastry portion: 4 minis (8/2, 12/3, 16/4). */
const MINIS_PER_FLAVOR = 4
const MINI_FILLING = 20

const ingredients: Catalog['ingredients'] = [
  // Pastry
  { name: 'Massa de pastel', unit: U, stock: 400, min: 80 },
  { name: 'Massa de mini pastel', unit: U, stock: 300, min: 60 },
  // Fillings
  { name: 'Carne moída', unit: G, stock: 8000, min: 1500 },
  { name: 'Frango desfiado', unit: G, stock: 5000, min: 1000 },
  { name: 'Calabresa', unit: G, stock: 3000, min: 500 },
  { name: 'Presunto', unit: G, stock: 3000, min: 500 },
  { name: 'Brócolis', unit: G, stock: 2000, min: 400 },
  { name: 'Escarola', unit: G, stock: 2000, min: 400 },
  { name: 'Palmito', unit: G, stock: 1500, min: 300 },
  { name: 'Berinjela', unit: G, stock: 1500, min: 300 },
  { name: 'Camarão 7 barbas', unit: G, stock: 2000, min: 400 },
  { name: 'Camarão rosa', unit: G, stock: 1500, min: 300 },
  { name: 'Salmão', unit: G, stock: 1500, min: 300 },
  { name: 'Carne seca', unit: G, stock: 2000, min: 400 },
  { name: 'Molho rosé', unit: G, stock: 800, min: 150 },
  // Cheeses
  { name: 'Mussarela', unit: G, stock: 6000, min: 1000 },
  { name: 'Catupiry', unit: G, stock: 3000, min: 500 },
  { name: 'Cheddar', unit: G, stock: 2000, min: 400 },
  { name: 'Cream cheese', unit: G, stock: 1500, min: 300 },
  { name: 'Parmesão', unit: G, stock: 1000, min: 200 },
  // Add-ons and seasoning
  { name: 'Bacon', unit: G, stock: 2000, min: 400 },
  { name: 'Ovo', unit: U, stock: 60, min: 12 },
  { name: 'Azeitona', unit: G, stock: 1000, min: 200 },
  { name: 'Tomate', unit: G, stock: 2000, min: 400 },
  { name: 'Milho', unit: G, stock: 1500, min: 300 },
  { name: 'Ervilha', unit: G, stock: 1500, min: 300 },
  { name: 'Cebola', unit: G, stock: 2000, min: 400 },
  { name: 'Orégano', unit: G, stock: 300, min: 50 },
  { name: 'Alho frito', unit: G, stock: 300, min: 50 },
  // Sweet
  { name: 'Chocolate ao leite', unit: G, stock: 2000, min: 400 },
  { name: 'Chocolate branco', unit: G, stock: 1500, min: 300 },
  { name: 'KitKat', unit: U, stock: 40, min: 10 },
  { name: 'Doce de leite', unit: G, stock: 1500, min: 300 },
  { name: 'Goiabada', unit: G, stock: 1500, min: 300 },
  { name: 'Nutella', unit: G, stock: 1500, min: 300 },
  { name: 'Banana', unit: U, stock: 40, min: 10 },
  { name: 'Açúcar e canela', unit: G, stock: 800, min: 150 },
  // Portions
  { name: 'Batata frita (congelada)', unit: G, stock: 10000, min: 2000 },
]

/** Fillings offered as "Recheio extra" (and the cheeses of "Escolha o queijo"). */
const FILLINGS: [key: string, name: string, ingredient: string][] = [
  ['carne', 'Carne moída', 'Carne moída'],
  ['frango', 'Frango', 'Frango desfiado'],
  ['calabresa', 'Calabresa', 'Calabresa'],
  ['presunto', 'Presunto', 'Presunto'],
  ['mussarela', 'Mussarela', 'Mussarela'],
  ['catupiry', 'Catupiry', 'Catupiry'],
  ['cheddar', 'Cheddar', 'Cheddar'],
  ['creamCheese', 'Cream cheese', 'Cream cheese'],
  ['brocolis', 'Brócolis', 'Brócolis'],
  ['escarola', 'Escarola', 'Escarola'],
  ['palmito', 'Palmito', 'Palmito'],
  ['berinjela', 'Berinjela', 'Berinjela'],
]

/** The seven simple flavors of the mini pastry portions (no Pizza). */
const MINI_FLAVORS: [key: string, name: string, ingredient: string][] = [
  ['miniEscarola', 'Escarola', 'Escarola'],
  ['miniBrocolis', 'Brócolis', 'Brócolis'],
  ['miniCalabresa', 'Calabresa', 'Calabresa'],
  ['miniPresunto', 'Presunto', 'Presunto'],
  ['miniQueijo', 'Queijo', 'Mussarela'],
  ['miniFrango', 'Frango', 'Frango desfiado'],
  ['miniCarne', 'Carne', 'Carne moída'],
]

const addons: Catalog['addons'] = [
  ...FILLINGS.map(([key, name, ingredient]) => ({
    key,
    name,
    price: 5,
    recipe: [[ingredient, EXTRA]] as [string, number][],
  })),
  // "Adicionais": complements with their own price, outside "Recheio extra".
  {
    key: 'bacon',
    name: 'Bacon',
    description: 'Pedaços de bacon',
    price: 5,
    recipe: [['Bacon', 20]],
    photo: 'pexels-4110376.webp',
  },
  {
    key: 'ovo',
    name: 'Ovo',
    description: 'Um ovo cozido inteiro',
    price: 5,
    recipe: [['Ovo', 1]],
    photo: 'pexels-4397261.webp',
  },
  {
    key: 'azeitona',
    name: 'Azeitona',
    description: 'Porção de azeitona',
    price: 3,
    recipe: [['Azeitona', 15]],
  },
  {
    key: 'tomate',
    name: 'Tomate',
    description: 'Porção de tomate',
    price: 3,
    recipe: [['Tomate', 20]],
    photo: 'pexels-11789795.webp',
  },
  {
    key: 'milho',
    name: 'Milho',
    description: 'Porção de milho',
    price: 3,
    recipe: [['Milho', 20]],
    photo: 'pexels-12408945.webp',
  },
  {
    key: 'ervilha',
    name: 'Ervilha',
    description: 'Porção de ervilha',
    price: 3,
    recipe: [['Ervilha', 20]],
  },
  {
    key: 'cebola',
    name: 'Cebola',
    description: 'Porção de cebola',
    price: 3,
    recipe: [['Cebola', 20]],
  },
  // "Opcionais": no price was given (free until the store sets one).
  { key: 'oregano', name: 'Orégano', price: 0, recipe: [['Orégano', 2]] },
  { key: 'alhoFrito', name: 'Alho frito', price: 0, recipe: [['Alho frito', 5]] },
  // Fries toppings (one per portion).
  {
    key: 'cheddarBacon',
    name: 'Cheddar + bacon',
    price: 20,
    recipe: [
      ['Cheddar', 80],
      ['Bacon', 40],
    ],
  },
  {
    key: 'catupiryBacon',
    name: 'Catupiry + bacon',
    price: 20,
    recipe: [
      ['Catupiry', 80],
      ['Bacon', 40],
    ],
  },
  {
    key: 'cheddarCatupiryBacon',
    name: 'Cheddar + Catupiry + bacon',
    price: 25,
    recipe: [
      ['Cheddar', 60],
      ['Catupiry', 60],
      ['Bacon', 40],
    ],
  },
  // Mini pastry flavors: each pick is 4 minis (filling and dough).
  ...MINI_FLAVORS.map(([key, name, ingredient]) => ({
    key,
    name,
    description: `${MINIS_PER_FLAVOR} mini pastéis deste sabor`,
    price: 0,
    recipe: [
      [ingredient, MINIS_PER_FLAVOR * MINI_FILLING],
      ['Massa de mini pastel', MINIS_PER_FLAVOR],
    ] as [string, number][],
  })),
]

const SIMPLE_EXTRAS = FILLINGS.slice(0, 10).map(([key]) => key)

const groups: Catalog['groups'] = [
  {
    key: 'cheese',
    name: 'Escolha o queijo',
    minChoices: 1,
    maxChoices: 1,
    // Included in the pastry's price.
    optionPrice: 0,
    options: ['mussarela', 'catupiry', 'cheddar', 'creamCheese'],
  },
  {
    // Simples: the 1st extra + R$ 3, the 2nd and 3rd + R$ 5 (18 → 21 → 26 → 31).
    key: 'extraSimples',
    name: 'Recheio extra',
    minChoices: 0,
    maxChoices: 3,
    pickPrices: [3, 5],
    options: SIMPLE_EXTRAS,
  },
  {
    // Especiais: + R$ 5 each, with palmito and berinjela (20 → 25 → 30 → 35).
    key: 'extraEspeciais',
    name: 'Recheio extra',
    minChoices: 0,
    maxChoices: 3,
    optionPrice: 5,
    options: [...SIMPLE_EXTRAS, 'palmito', 'berinjela'],
  },
  {
    key: 'optionals',
    name: 'Opcionais',
    minChoices: 0,
    maxChoices: 1,
    options: ['oregano', 'alhoFrito'],
  },
  {
    key: 'friesTopping',
    name: 'Cobertura',
    minChoices: 0,
    maxChoices: 1,
    options: ['cheddarBacon', 'catupiryBacon', 'cheddarCatupiryBacon'],
  },
  ...[2, 3, 4].map((flavors) => ({
    key: `minis${flavors}`,
    name: `Escolha ${flavors} sabores`,
    minChoices: flavors,
    maxChoices: flavors,
    // Queijo twice = 8 minis of cheese.
    allowRepeat: true,
    options: MINI_FLAVORS.map(([key]) => key),
  })),
]

const COMPLEMENTS = ['bacon', 'ovo', 'azeitona', 'tomate', 'milho', 'ervilha', 'cebola']

/**
 * A savory pastry: the dough plus its filling. "Escolha o queijo" goes to
 * every pastry whose name or description mentions cheese ("4 Queijos"
 * already has its four), and its cheese leaves the recipe: the choice
 * deducts it, never twice.
 */
function pastry(
  name: string,
  description: string,
  filling: [string, number][],
  extra: string | null,
  options: { photo?: string; cheese?: boolean; complements?: string[] } = {}
): CatalogItem {
  const cheese = options.cheese ?? /queijo/i.test(`${name} ${description}`)
  return {
    name,
    description,
    photo: options.photo,
    recipe: [['Massa de pastel', 1], ...filling],
    groups: [...(cheese ? ['cheese'] : []), ...(extra ? [extra] : []), 'optionals'],
    addons: options.complements ?? COMPLEMENTS,
  }
}

function sweet(name: string, description: string, filling: [string, number][], photo?: string) {
  const cheese = /queijo/i.test(`${name} ${description}`)
  return {
    name,
    description,
    photo,
    recipe: [['Massa de pastel', 1], ...filling] as [string, number][],
    groups: cheese ? ['cheese'] : [],
    addons: [],
  }
}

function drink(name: string, description: string, price: number, photo?: string): CatalogItem {
  // One stock line per product (brand, flavor, package and size), sold whole.
  return {
    name,
    description,
    price,
    photo,
    recipe: [[name, 1]],
    groups: [],
    addons: [],
    stock: { stock: 48, min: 12 },
  }
}

const categories: Catalog['categories'] = [
  {
    name: 'Pastéis Simples',
    price: 18,
    items: [
      pastry(
        'Pastel de Carne',
        'Recheado com Carne Moída e Temperada',
        [['Carne moída', MAIN]],
        'extraSimples',
        { photo: 'pexels-37118885.webp' }
      ),
      pastry('Pastel de Queijo', 'Queijo à sua Escolha, Derretido e Cremoso', [], 'extraSimples', {
        photo: 'pexels-6054485.webp',
      }),
      pastry(
        'Pastel de Frango',
        'Frango Desfiado e Temperado',
        [['Frango desfiado', MAIN]],
        'extraSimples',
        { photo: 'pexels-15010282.webp' }
      ),
      pastry('Pastel de Presunto', 'Presunto Triturado', [['Presunto', MAIN]], 'extraSimples', {
        photo: 'pexels-14699211.webp',
      }),
      pastry('Pastel de Calabresa', 'Calabresa Triturada', [['Calabresa', MAIN]], 'extraSimples'),
      pastry(
        'Pastel de Brócolis',
        'Brócolis Destrinchado e Temperado',
        [['Brócolis', MAIN]],
        'extraSimples',
        { photo: 'pexels-14699210.webp' }
      ),
      pastry(
        'Pastel de Escarola',
        'Escarola Temperada Crua (cozinha por dentro do pastel)',
        [['Escarola', MAIN]],
        'extraSimples',
        { photo: 'pexels-14699209.webp' }
      ),
    ],
  },
  {
    name: 'Pastéis Especiais',
    price: 20,
    items: [
      pastry(
        'Pastel de Pizza',
        'Queijo, Tomate e Orégano',
        [
          ['Tomate', 20],
          ['Orégano', 2],
        ],
        'extraEspeciais',
        { photo: 'pexels-28442527.webp' }
      ),
      pastry(
        'Pastel de Calafrango',
        'Calabresa com Frango',
        [
          ['Calabresa', SECOND],
          ['Frango desfiado', SECOND],
        ],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Berinjela',
        'Berinjela Temperada e Cozida',
        [['Berinjela', MAIN]],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Palmito',
        'Palmito em Cubos Cozido, Temperado e Finalizado com Creme',
        [
          ['Palmito', MAIN],
          ['Catupiry', 20],
        ],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Bauru',
        'Presunto, Queijo e Orégano',
        [
          ['Presunto', SECOND],
          ['Orégano', 2],
        ],
        'extraEspeciais',
        { photo: 'pexels-30893317.webp' }
      ),
      pastry(
        'Pastel de Camarão',
        'Camarão 7 Barbas Cozido, Temperado e Finalizado com Creme',
        [
          ['Camarão 7 barbas', MAIN],
          ['Catupiry', 20],
        ],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Carne Seca',
        'Carne Seca Triturada e Cozida',
        [['Carne seca', MAIN]],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Carne com Ovo',
        'Carne Moída com Ovo Cozido',
        [
          ['Carne moída', MAIN],
          ['Ovo', 1],
        ],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Carne com Queijo',
        'Carne Moída Acompanhada de Queijo à sua Escolha',
        [['Carne moída', MAIN]],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de FranBacon',
        'Frango com Bacon em Pedaços',
        [
          ['Frango desfiado', SECOND],
          ['Bacon', SECOND],
        ],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Frango com Queijo',
        'Frango Cozido com Queijo à sua Escolha',
        [['Frango desfiado', MAIN]],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Brócolis com Queijo',
        'Brócolis Cozido com Queijo à sua Escolha',
        [['Brócolis', MAIN]],
        'extraEspeciais',
        { photo: 'pexels-24962986.webp' }
      ),
      pastry(
        'Pastel de Escarola com Queijo',
        'Escarola com Queijo à sua Escolha',
        [['Escarola', MAIN]],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Presunto com Queijo',
        'Presunto com Queijo à sua Escolha',
        [['Presunto', MAIN]],
        'extraEspeciais'
      ),
      pastry(
        'Pastel de Calabresa com Queijo',
        'Calabresa Triturada com Queijo à sua Escolha',
        [['Calabresa', MAIN]],
        'extraEspeciais'
      ),
    ],
  },
  {
    name: 'Pastéis Selecionados',
    price: 25,
    items: [
      pastry(
        'Pastel de Portuguesa',
        'Ovo, Queijo, Presunto e Orégano',
        [
          ['Ovo', 1],
          ['Presunto', SECOND],
          ['Orégano', 2],
        ],
        null
      ),
      pastry(
        'Pastel Vegetariano',
        'Brócolis, Queijo, Tomate e Azeitona',
        [
          ['Brócolis', SECOND],
          ['Tomate', 20],
          ['Azeitona', 15],
        ],
        null
      ),
      pastry(
        'Pastel Vegano',
        'Brócolis, Escarola, Tomate e Azeitona',
        [
          ['Brócolis', SECOND],
          ['Escarola', SECOND],
          ['Tomate', 20],
          ['Azeitona', 15],
        ],
        null,
        {
          // Nothing of animal origin offered on the vegan pastry.
          complements: ['azeitona', 'tomate', 'milho', 'ervilha', 'cebola'],
        }
      ),
      pastry(
        'Pastel de 4 Queijos',
        'Queijo, Catupiry, Cheddar e Parmesão',
        [
          ['Mussarela', 30],
          ['Catupiry', 30],
          ['Cheddar', 30],
          ['Parmesão', 15],
        ],
        null,
        { cheese: false }
      ),
      pastry(
        'Pastel Frango Supremo',
        'Frango, Queijo, Tomate e Milho',
        [
          ['Frango desfiado', MAIN],
          ['Tomate', 20],
          ['Milho', 20],
        ],
        null
      ),
      pastry(
        'Pastel de Camarão com Queijo',
        'Camarão com Queijo à sua Escolha',
        [['Camarão 7 barbas', MAIN]],
        null
      ),
      pastry(
        'Pastel de Carne Seca com Queijo',
        'Carne Seca com Queijo à sua Escolha',
        [['Carne seca', MAIN]],
        null
      ),
    ],
  },
  {
    name: 'Pastéis Premium',
    description:
      'Todos os Pastéis Premium acompanham um queijo à sua escolha: Mussarela, Catupiry, Cheddar ou Cream Cheese',
    price: 38,
    items: [
      pastry(
        'Pastel de Camarão Rosa',
        'Camarão Rosa com Molho Rosé ou Grelhado',
        [
          ['Camarão rosa', MAIN],
          ['Molho rosé', 30],
        ],
        null,
        { cheese: true, photo: 'pexels-34389364.webp' }
      ),
      pastry('Pastel de Salmão', 'Salmão grelhado', [['Salmão', MAIN]], null, { cheese: true }),
    ],
  },
  {
    name: 'Pastéis Doces',
    price: 25,
    items: [
      sweet('Pastel de Brigadeiro', 'Chocolate Derretido', [['Chocolate ao leite', MAIN]]),
      sweet('Pastel de KitKat', 'Creme de KitKat com Pedacinhos de KitKat', [
        ['Chocolate ao leite', 50],
        ['KitKat', 1],
      ]),
      sweet('Pastel de Doce de Leite', 'Recheado com Doce de leite', [['Doce de leite', MAIN]]),
      sweet('Pastel Romeu e Julieta', 'Goiabada com queijo', [['Goiabada', 50]]),
      sweet('Pastel de Nutella', 'Creme de Avelã com Cacau e Leite', [['Nutella', MAIN]]),
      sweet('Pastel de Chocolate Branco', 'Creme de Chocolate Branco', [
        ['Chocolate branco', MAIN],
      ]),
      sweet('Pastel de Banana com Canela', 'Banana Fatiada com Açúcar e Canela', [
        ['Banana', 1],
        ['Açúcar e canela', 10],
      ]),
    ],
  },
  {
    name: 'Porções',
    items: [
      {
        name: 'Porção de Batata Frita',
        description: 'Batata frita crocante. Escolha uma cobertura, se quiser.',
        price: 60,
        recipe: [['Batata frita (congelada)', 400]],
        groups: ['friesTopping'],
        addons: [],
      },
    ],
  },
  {
    name: 'Porções de Mini Pastéis',
    description:
      'Sabores simples: escarola, brócolis, calabresa, presunto, queijo, frango ou carne. 4 mini pastéis de cada sabor escolhido.',
    items: [
      {
        name: '8 Mini Pastéis',
        description: 'Escolha 2 sabores (4 de cada)',
        price: 80,
        recipe: [],
        groups: ['minis2'],
        addons: [],
      },
      {
        name: '12 Mini Pastéis',
        description: 'Escolha 3 sabores (4 de cada)',
        price: 100,
        recipe: [],
        groups: ['minis3'],
        addons: [],
      },
      {
        name: '16 Mini Pastéis',
        description: 'Escolha 4 sabores (4 de cada)',
        price: 120,
        recipe: [],
        groups: ['minis4'],
        addons: [],
      },
    ],
  },
  {
    name: 'Bebidas',
    // Ready-made: straight to the counter, never the kitchen.
    requiresPreparation: false,
    items: [
      drink('Coca-Cola Original lata 350 ml', 'Refrigerante em lata', 10),
      drink('Coca-Cola Zero lata 350 ml', 'Refrigerante em lata, sem açúcar', 10),
      drink('Guaraná Antarctica lata 350 ml', 'Refrigerante em lata', 10, 'pexels-32183186.webp'),
      drink('Guaraná Antarctica Zero lata 350 ml', 'Refrigerante em lata, sem açúcar', 10),
      drink('Sprite lata 350 ml', 'Refrigerante em lata', 10, 'pexels-31332092.webp'),
      drink('Schweppes lata 350 ml', 'Refrigerante em lata', 10),
      drink('Fanta Uva lata 350 ml', 'Refrigerante em lata', 10),
      drink('Fanta Laranja lata 350 ml', 'Refrigerante em lata', 10, 'pexels-13950097.webp'),
      drink('Coca-Cola Original 200 ml', 'Refrigerante em garrafinha', 6),
      drink('Coca-Cola Zero 200 ml', 'Refrigerante em garrafinha, sem açúcar', 6),
      drink('Coca-Cola Original 600 ml', 'Refrigerante em garrafa', 15),
      drink('Guaraná Antarctica normal 600 ml', 'Refrigerante em garrafa', 15),
      drink('Suco Del Valle Maracujá lata 290 ml', 'Suco Del Valle em lata', 10),
      drink('Suco Del Valle Uva lata 290 ml', 'Suco Del Valle em lata', 10),
      drink('Suco Del Valle Pêssego lata 290 ml', 'Suco Del Valle em lata', 10),
      drink('Suco Del Valle Goiaba lata 290 ml', 'Suco Del Valle em lata', 10),
      drink('Suco Del Valle Manga lata 290 ml', 'Suco Del Valle em lata', 10),
      drink('Guaraviton Açaí 500 ml', 'Bebida de guaraná com açaí em garrafa', 10),
      drink('H2O Limão 500 ml', 'Refrigerante levemente gaseificado em garrafa', 10),
      drink('H2O Limoneto 500 ml', 'Refrigerante levemente gaseificado em garrafa', 10),
      drink('Água mineral sem gás 500 ml', 'Garrafa', 6),
      drink('Água mineral com gás 500 ml', 'Garrafa', 8),
    ],
  },
]

export const JJ_PASTEIS: Catalog = { ingredients, addons, groups, categories }

/** JJ Pastéis' public profile (the menu's header, logo and banner). */
export const JJ_PASTEIS_PROFILE: CatalogStoreProfile = {
  description: 'Pastéis feitos na hora, crocantes e bem recheados desde 2021.',
  address: 'Praia do Boqueirão - Santos / SP',
  instagramUrl: 'https://www.instagram.com/pasteisjjofc/',
  banner: 'jj-banner.jpg',
  logo: 'jj-logo.png',
}
