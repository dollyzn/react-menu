import vine from '@vinejs/vine'

export const profileValidator = vine.create(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(80),
  })
)

/** The panel sends a square WebP of at most 512px. */
export const avatarValidator = vine.create(
  vine.object({
    avatar: vine.file({ size: '2mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }),
  })
)

export const changePasswordValidator = vine.create(
  vine.object({
    currentPassword: vine.string().minLength(1).maxLength(512),
    // Same rule as a reset; "confirmed" checks passwordConfirmation.
    password: vine
      .string()
      .minLength(8)
      .maxLength(512)
      .confirmed({ confirmationField: 'passwordConfirmation' }),
  })
)

export const sessionIdValidator = vine.create(vine.number().withoutDecimals().positive())

/** A 6-digit code of the authenticator app. */
export const totpCodeValidator = vine.create(
  vine.object({
    code: vine.string().trim().minLength(6).maxLength(10),
  })
)

export const passwordConfirmValidator = vine.create(
  vine.object({
    password: vine.string().minLength(1).maxLength(512),
  })
)
