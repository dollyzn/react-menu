import vine from '@vinejs/vine'

const name = vine.string().trim()
const description = vine.string().trim().optional()

const storeValidator = vine.create(
  vine.object({
    name,
    description,
  })
)

const updateValidator = vine.create(
  vine.object({
    name: name.optional(),
    description,
  })
)

const reorderValidator = vine.create(
  vine.object({
    ids: vine.array(vine.number()).minLength(1),
  })
)

const bulkDeleteValidator = vine.create(
  vine.object({
    ids: vine.array(vine.number()).minLength(1),
  })
)

export { storeValidator, updateValidator, reorderValidator, bulkDeleteValidator }
