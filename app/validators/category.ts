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

const updateOrderValidator = vine.create(
  vine.object({
    id: vine.number().exists(async (db, value) => {
      return await db.from('categories').select('id').where('id', value).first()
    }),
    order: vine.number().min(0),
  })
)

const bulkDeleteValidator = vine.create(
  vine.object({
    ids: vine.array(
      vine
        .number()
        .exists(
          async (db, value) => await db.from('categories').select('id').where('id', value).first()
        )
    ),
  })
)

export { storeValidator, updateValidator, updateOrderValidator, bulkDeleteValidator }
