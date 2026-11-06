import type IngredientUnit from '#enums/ingredient_unit'

/** [ingredient name, quantity in its unit] */
export type RecipeLine = [string, number]

export type CatalogItem = {
  name: string
  description: string
  /** Defaults to the category's price. */
  price?: number
  /** A file in database/data/menu-photos (none: the menu's placeholder). */
  photo?: string
  recipe: RecipeLine[]
  /** Choice groups (keys), in display order. */
  groups: string[]
  /** Add-ons offered on the item (keys), outside any group ("Adicionais"). */
  addons: string[]
  /** Its own stock line, named after the item (drinks sold whole). */
  stock?: { stock: number; min: number }
}

/**
 * A store's menu as data: stock items, add-ons (with recipes), choice groups
 * and categories of items. Names refer to each other; `key`s are local.
 */
/** The store's public profile, filled where the store left it empty. */
export type CatalogStoreProfile = {
  description: string
  address: string
  instagramUrl: string
  /** Files in database/data. */
  banner: string
  logo: string
}

export type Catalog = {
  ingredients: { name: string; unit: IngredientUnit; stock: number; min: number }[]
  addons: {
    key: string
    name: string
    description?: string
    price: number
    recipe: RecipeLine[]
    photo?: string
  }[]
  groups: {
    key: string
    name: string
    minChoices: number
    maxChoices: number
    /** Every option's price in this group (absent: the add-on's own price). */
    optionPrice?: number
    /** Price by pick order (see OptionGroup.pickPrices). */
    pickPrices?: number[]
    options: string[]
  }[]
  categories: {
    name: string
    description?: string
    /** False for drinks and ready-made products (default true). */
    requiresPreparation?: boolean
    /** Default price of its items. */
    price?: number
    items: CatalogItem[]
  }[]
}
