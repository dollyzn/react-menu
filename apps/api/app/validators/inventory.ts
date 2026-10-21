import vine from '@vinejs/vine'
import IngredientUnit from '#enums/ingredient_unit'
import StockMovementType from '#enums/stock_movement_type'

/** One emoji (null clears it and falls back to the suggestion). */
const icon = vine
  .string()
  .trim()
  .maxLength(16)
  .regex(/^\p{Extended_Pictographic}/u)
  .nullable()

const quantity = vine.number().min(0).max(1_000_000)

const ingredientValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    unit: vine.enum(Object.values(IngredientUnit)),
    icon: icon.optional(),
    minStock: quantity.optional(),
    /** Initial stock, recorded as an adjustment. Only on create. */
    stockQuantity: quantity.optional(),
  })
)

const updateIngredientValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    unit: vine.enum(Object.values(IngredientUnit)).optional(),
    icon: icon.optional(),
    minStock: quantity.optional(),
  })
)

/**
 * purchase/waste: amount added/removed. adjustment: the counted stock; the
 * difference to the current stock is recorded.
 */
const stockMovementValidator = vine.create(
  vine.object({
    type: vine.enum([
      StockMovementType.PURCHASE,
      StockMovementType.WASTE,
      StockMovementType.ADJUSTMENT,
    ]),
    quantity,
    note: vine.string().trim().maxLength(500).optional(),
  })
)

const recipeValidator = vine.create(
  vine.object({
    ingredients: vine.array(
      vine.object({
        ingredientId: vine.number(),
        quantity: vine.number().positive().max(100_000),
      })
    ),
  })
)

export { ingredientValidator, updateIngredientValidator, stockMovementValidator, recipeValidator }
