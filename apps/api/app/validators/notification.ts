import vine from '@vinejs/vine'

/** Firebase Installation IDs are short URL-safe base64 strings. */
const pushRegistrationValidator = vine.create(
  vine.object({
    fid: vine
      .string()
      .maxLength(255)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
)

export { pushRegistrationValidator }
