import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const uuidValidator = vine.compile(vine.string().uuid())

const numberValidator = vine.compile(vine.number())

const storeExistValidator = vine.compile(
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
