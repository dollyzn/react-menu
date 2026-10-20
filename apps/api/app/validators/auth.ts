import vine from '@vinejs/vine'

const loginValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().normalizeEmail(),
    password: vine.string().minLength(6).maxLength(512),
  })
)

export { loginValidator }
