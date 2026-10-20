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

const categoryExistValidator = vine.create(categoryId)

categoryExistValidator.messagesProvider = new SimpleMessagesProvider({
  'database.exists': 'Categoria não encontrada',
})

const storeValidator = vine.create(
  vine.object({
    name,
    description,
    price,
    photoUrl,
    addonIds,
  })
)

const updateValidator = vine.create(
  vine.object({
    name: name.optional(),
    description,
    price: price.optional(),
    categoryId,
    photoUrl,
    addonIds,
  })
)

const reorderValidator = vine.create(
  vine.object({
    ids: vine.array(vine.string().uuid()).minLength(1),
  })
)

const bulkDeleteValidator = vine.create(
  vine.object({
    ids: vine.array(vine.string().uuid()).minLength(1),
  })
)

export {
  bulkDeleteValidator,
  categoryExistValidator,
  storeValidator,
  updateValidator,
  reorderValidator,
}
