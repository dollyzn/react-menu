import vine from '@vinejs/vine'

const password = vine.string().minLength(6).maxLength(512)

const registerValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(3).maxLength(64).trim(),
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

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email().trim().normalizeEmail(),
    password,
  })
)

export { registerValidator, loginValidator }
