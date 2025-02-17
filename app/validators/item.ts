import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const name = vine.string().trim()
const description = vine.string().optional()
const price = vine.number().positive()
const categoryId = vine.number().exists(async (db, value) => {
  return await db.from('categories').select('id').where('id', value).first()
})
const photoUrl = vine.string().optional()
const addonIds = vine
  .array(
    vine
      .string()
      .uuid()
      .exists(async (db, value) => {
        return await db.from('addons').select('id').where('id', value).first()
      })
  )
  .optional()

const categoryExistValidator = vine.compile(categoryId)

categoryExistValidator.messagesProvider = new SimpleMessagesProvider({
  'database.exists': 'Categoria não encontrada',
})

const storeValidator = vine.compile(
  vine.object({
    name,
    description,
    price,
    photoUrl,
    addonIds,
  })
)

const updateValidator = vine.compile(
  vine.object({
    name: name.optional(),
    description,
    price: price.optional(),
    categoryId,
    photoUrl,
    addonIds,
  })
)

const updateOrderValidator = vine.compile(
  vine.object({
    id: vine
      .string()
      .uuid()
      .exists(async (db, value) => {
        return await db.from('items').select('id').where('id', value).first()
      }),
    order: vine.number().min(0),
  })
)

export { categoryExistValidator, storeValidator, updateValidator, updateOrderValidator }
