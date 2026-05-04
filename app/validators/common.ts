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

export { uuidValidator, numberValidator, storeExistValidator }
