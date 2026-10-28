import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const name = vine.string().trim()
const description = vine.string().optional()
const price = vine.number().positive()
const categoryId = vine.number().exists(async (db, value) => {
  return await db.from('categories').select('id').where('id', value).first()
})
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

/** Choice groups of the item, in display order. */
const optionGroupIds = vine.array(vine.string().uuid()).maxLength(10).distinct().optional()

const storeValidator = vine.create(
  vine.object({
    name,
    description,
    price,
    addonIds,
    optionGroupIds,
  })
)

const updateValidator = vine.create(
  vine.object({
    name: name.optional(),
    description,
    price: price.optional(),
    // Optional: partial updates (e.g. "Marcar esgotado") send only what changes.
    categoryId: categoryId.optional(),
    addonIds,
    optionGroupIds,
    isAvailable: vine.boolean().optional(),
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

/**
 * The item's photo (`PUT …/items/:id/photo`). The panel sends it already
 * resized to WebP; JPEG/PNG straight from a phone also work.
 */
const itemPhotoValidator = vine.create(
  vine.object({
    photo: vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }),
  })
)

export {
  bulkDeleteValidator,
  itemPhotoValidator,
  categoryExistValidator,
  storeValidator,
  updateValidator,
  reorderValidator,
}
