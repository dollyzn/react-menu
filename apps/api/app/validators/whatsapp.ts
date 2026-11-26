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
    /** Left out when Meta's window message didn't reach the page: found from the token. */
    wabaId: graphId.clone().optional().requiredIfExists('phoneNumberId'),
    phoneNumberId: graphId.clone().optional().requiredIfExists('wabaId'),
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
    /** Per order notice: on or off (received, preparing, ready, completed, cancelled). */
    notices: vine
      .object({
        received: vine.boolean().optional(),
        preparing: vine.boolean().optional(),
        ready: vine.boolean().optional(),
        completed: vine.boolean().optional(),
        cancelled: vine.boolean().optional(),
      })
      .optional(),
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
