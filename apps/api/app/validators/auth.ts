import vine from '@vinejs/vine'

const loginValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().normalizeEmail(),
    password: vine.string().minLength(6).maxLength(512),
  })
)

/** "Esqueci minha senha": always answered the same way (no account lookup leaks). */
const forgotPasswordValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().normalizeEmail().maxLength(254),
  })
)

const resetPasswordValidator = vine.create(
  vine.object({
    token: vine.string().trim().minLength(20).maxLength(200),
    password: vine.string().minLength(8).maxLength(512),
  })
)

/** The second step: a 6-digit code, or a recovery code ("ABCD-EFGH"). */
const twoFactorValidator = vine.create(
  vine.object({
    code: vine.string().trim().minLength(6).maxLength(20),
    recovery: vine.boolean().optional(),
    /** "Confiar neste dispositivo por 30 dias". */
    remember: vine.boolean().optional(),
  })
)

export { loginValidator, forgotPasswordValidator, resetPasswordValidator, twoFactorValidator }
