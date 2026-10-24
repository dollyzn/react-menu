import vine from '@vinejs/vine'

/** A choice group: its options are the store's add-ons, in display order. */
export const optionGroupValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    minChoices: vine.number().withoutDecimals().min(0).max(20),
    maxChoices: vine.number().withoutDecimals().min(1).max(20),
    addonIds: vine.array(vine.string().uuid()).minLength(1).maxLength(30).distinct(),
  })
)
