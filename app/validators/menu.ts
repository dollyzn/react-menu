import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const storeExistValidator = vine.create(
  vine
    .string()
    .regex(/^[a-z0-9-]+$/)
    .exists(async (db, value) => {
      return await db.from('stores').select('id').where('slug', value).first()
    })
    .optional()
)

storeExistValidator.messagesProvider = new SimpleMessagesProvider({
  'database.exists': 'Loja não encontrada',
})

export { storeExistValidator }
