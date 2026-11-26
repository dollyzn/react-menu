import vine from '@vinejs/vine'

/** Graph ids are numeric strings. */
const graphId = vine
  .string()
  .trim()
  .regex(/^\d{1,40}$/)

/** Embedded Signup finished in the browser (ADR 0025). */
export const whatsappConnectValidator = vine.create(
  vine.object({
    code: vine.string().trim().minLength(10).maxLength(1024),
    wabaId: graphId,
    phoneNumberId: graphId,
    businessId: graphId.clone().optional(),
    /** FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING: a WhatsApp Business app number. */
    coexistence: vine.boolean().optional(),
  })
)

/** Development fake (WHATSAPP_FAKE): connects without Meta's flow. */
export const whatsappFakeConnectValidator = vine.create(vine.object({ fake: vine.literal(true) }))

export const whatsappSettingsValidator = vine.create(
  vine.object({
    notifyOrders: vine.boolean().optional(),
    customerLogin: vine.boolean().optional(),
  })
)

/** Starting the history sign-in on the public menu. */
export const customerLoginStartValidator = vine.create(
  vine.object({
    method: vine.enum(['message', 'code'] as const),
    phone: vine
      .string()
      .trim()
      .minLength(8)
      .maxLength(25)
      .optional()
      .requiredWhen('method', '=', 'code'),
  })
)

export const customerLoginClaimValidator = vine.create(
  vine.object({
    secret: vine.string().trim().minLength(20).maxLength(100),
    code: vine
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .optional(),
  })
)
