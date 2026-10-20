import vine from '@vinejs/vine'

const name = vine.string().trim()
const description = vine.string().trim().optional()
const price = vine.number().positive()
const photoUrl = vine.string().optional()

const itemExistValidator = vine.create(
  vine
    .string()
    .uuid()
    .exists(async (db, value) => {
      return await db.from('items').select('id').where('id', value).first()
    })
)

const storeValidator = vine.create(
  vine.object({
    name,
    description,
    price,
    photoUrl,
  })
)

const updateValidator = vine.create(
  vine.object({
    name: name.optional(),
    description,
    price: price.optional(),
    photoUrl,
  })
)

const bulkDeleteValidator = vine.create(
  vine.object({
    ids: vine.array(vine.string().uuid()).minLength(1),
  })
)

export { itemExistValidator, storeValidator, updateValidator, bulkDeleteValidator }
