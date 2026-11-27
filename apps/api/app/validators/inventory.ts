import vine from '@vinejs/vine'
import IngredientUnit from '#enums/ingredient_unit'
import StockMovementType from '#enums/stock_movement_type'
import { INGREDIENT_ICON_COLORS } from '#kitchen/ingredient_icons'

/**
 * The badge's tag: up to 3 letters or digits, kept upper case, or `false`
 * for no tag (an empty string arrives as null: the body parser). A rule, not
 * `vine.union`, which drops a null (automatic).
 */
const iconLabel = vine.createRule((value, _options, field) => {
  if (value === false) return
  // Checked upper-cased: that is what is stored, and it can grow ("ß" → "SS").
  const tag = typeof value === 'string' ? value.trim().toLocaleUpperCase('pt-BR') : null
  if (tag === null || !/^[\p{L}\p{N}]{1,3}$/u.test(tag)) {
    field.report('Use até 3 letras ou números.', 'iconLabel', field)
    return
  }
  field.mutate(tag, field)
})

/** The badge: null = automatic from the name. */
const badge = {
  /** One emoji. */
  icon: vine
    .string()
    .trim()
    .maxLength(16)
    .regex(/^\p{Extended_Pictographic}/u)
    .nullable()
    .optional(),
  iconColor: vine.enum(INGREDIENT_ICON_COLORS).nullable().optional(),
  iconLabel: vine.any().use(iconLabel()).nullable().optional(),
}

const quantity = vine.number().min(0).max(1_000_000)

const ingredientValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    unit: vine.enum(Object.values(IngredientUnit)),
    ...badge,
    minStock: quantity.optional(),
    /** Initial stock, recorded as an adjustment. Only on create. */
    stockQuantity: quantity.optional(),
  })
)

const updateIngredientValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    unit: vine.enum(Object.values(IngredientUnit)).optional(),
    ...badge,
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

/** GET /ingredients/badge?name=: the automatic badge, for the form's preview. */
const badgePreviewValidator = vine.create(
  vine.object({ name: vine.string().trim().maxLength(120) })
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

export {
  badgePreviewValidator,
  ingredientValidator,
  updateIngredientValidator,
  stockMovementValidator,
  recipeValidator,
}
