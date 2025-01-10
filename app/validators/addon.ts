import vine from '@vinejs/vine'

const name = vine.string().trim()
const description = vine.string().trim().optional()
const price = vine.number().positive()
const photoUrl = vine.string().optional()

const itemExistValidator = vine.compile(
  vine
    .string()
    .uuid()
    .exists(async (db, value) => {
      return await db.from('items').select('id').where('id', value).first()
    })
)

const storeValidator = vine.compile(
  vine.object({
    name,
    description,
    price,
    photoUrl,
  })
)

const updateValidator = vine.compile(
  vine.object({
    name: name.optional(),
    description,
    price: price.optional(),
    photoUrl,
  })
)

export { itemExistValidator, storeValidator, updateValidator }
