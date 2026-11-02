import vine from '@vinejs/vine'

/**
 * A choice group: its options are the store's add-ons, in display order,
 * each with its price in this group (null = the add-on's own price).
 */
export const optionGroupValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    minChoices: vine.number().withoutDecimals().min(0).max(20),
    maxChoices: vine.number().withoutDecimals().min(1).max(20),
    options: vine
      .array(
        vine.object({
          addonId: vine.string().uuid(),
          price: vine.number().min(0).max(99999.99).decimal([0, 2]).nullable(),
        })
      )
      .minLength(1)
      .maxLength(30)
      .distinct('addonId'),
  })
)
