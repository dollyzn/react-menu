import vine from '@vinejs/vine'

/** null clears a credential; production tokens start with APP_USR-, test ones with TEST-. */
const paymentSettingsValidator = vine.create(
  vine.object({
    mercadoPagoAccessToken: vine
      .string()
      .trim()
      .regex(/^(APP_USR|TEST)-[\w-]+$/)
      .maxLength(300)
      .nullable()
      .optional(),
    mercadoPagoWebhookSecret: vine
      .string()
      .trim()
      .minLength(8)
      .maxLength(300)
      .nullable()
      .optional(),
  })
)

export { paymentSettingsValidator }
