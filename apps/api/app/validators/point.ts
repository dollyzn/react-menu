import vine from '@vinejs/vine'
import { POINT_PAYMENT_TYPES } from '#payments/point'

const terminalId = vine
  .string()
  .trim()
  .maxLength(120)
  .regex(/^[\w-]+$/)

/** How the store's card machines charge. */
const pointSettingsValidator = vine.create(
  vine.object({
    paymentTypes: vine.array(vine.enum(POINT_PAYMENT_TYPES)).minLength(1).distinct(),
    maxInstallments: vine.number().withoutDecimals().min(1).max(12),
    printTicket: vine.boolean(),
  })
)

/** Turning a machine on for the store. */
const pointTerminalValidator = vine.create(
  vine.object({
    terminalId,
    name: vine.string().trim().minLength(1).maxLength(60),
  })
)

/** A charge from the POS; no type = the customer picks on the machine. */
const pointChargeValidator = vine.create(
  vine.object({
    terminalId: terminalId.clone().optional(),
    paymentType: vine.enum(POINT_PAYMENT_TYPES).nullable(),
    installments: vine.number().withoutDecimals().min(1).max(12).optional(),
  })
)

const pointSimulateValidator = vine.create(vine.object({ approve: vine.boolean() }))

export {
  pointSettingsValidator,
  pointTerminalValidator,
  pointChargeValidator,
  pointSimulateValidator,
  terminalId as terminalIdRule,
}
