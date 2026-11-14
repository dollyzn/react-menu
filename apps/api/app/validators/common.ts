import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const uuidValidator = vine.create(vine.string().uuid())

const numberValidator = vine.create(vine.number())

const storeExistValidator = vine.create(
  vine
    .string()
    .uuid()
    .exists(async (db, value) => {
      return await db.from('stores').select('id').where('id', value).first()
    })
)

storeExistValidator.messagesProvider = new SimpleMessagesProvider({
  'database.exists': 'Loja não encontrada',
})

/**
 * An uploaded menu photo (an item's or an add-on's, `PUT …/photo`). The panel
 * sends it already resized to WebP; JPEG/PNG straight from a phone also work.
 */
const photoValidator = vine.create(
  vine.object({
    photo: vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }),
  })
)

export { uuidValidator, numberValidator, storeExistValidator, photoValidator }
