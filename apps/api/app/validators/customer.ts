import vine from '@vinejs/vine'

const customerSearchValidator = vine.create(
  vine.object({
    search: vine.string().trim().maxLength(80).optional(),
  })
)

export { customerSearchValidator }
