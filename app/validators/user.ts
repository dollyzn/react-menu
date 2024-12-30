import vine from '@vinejs/vine'

const name = vine.string().trim()
const password = vine.string().minLength(6).maxLength(512)
const storeIds = vine.array(
  vine
    .string()
    .uuid()
    .exists(async (db, value) => await db.from('stores').select('id').where('id', value).first())
)

const storeValidator = vine.compile(
  vine.object({
    name,
    email: vine
      .string()
      .email()
      .trim()
      .normalizeEmail()
      .unique(async (db, value) => {
        const match = await db.from('users').select('id').where('email', value).first()
        return !match
      }),
    password,
  })
)

const updateValidator = vine.compile(
  vine.object({
    name,
    email: vine
      .string()
      .email()
      .trim()
      .normalizeEmail()
      .unique(async (db, value, field) => {
        const userId = field.data.params.id
        const match = await db
          .from('users')
          .select('id')
          .where('email', value)
          .andWhereNot('id', userId)
          .first()

        return !match
      }),
    password: password.optional(),
    storeIds,
  })
)

export { storeValidator, updateValidator }
