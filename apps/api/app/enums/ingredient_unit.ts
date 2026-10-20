/** Recipe quantities use the ingredient's own unit. */
const IngredientUnit = {
  GRAM: 'g',
  KILOGRAM: 'kg',
  MILLILITER: 'ml',
  LITER: 'l',
  UNIT: 'un',
} as const

type IngredientUnit = (typeof IngredientUnit)[keyof typeof IngredientUnit]

export default IngredientUnit
