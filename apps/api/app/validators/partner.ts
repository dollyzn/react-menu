import vine from '@vinejs/vine'
import PartnerCancelPolicy from '#enums/partner_cancel_policy'
import PartnerCatalogMode from '#enums/partner_catalog_mode'
import PartnerCommissionType from '#enums/partner_commission_type'

/** A partner's name and rules (ADR 0024). */
export const partnerFields = vine.object({
  name: vine.string().trim().minLength(2).maxLength(80),
  commissionType: vine.enum(Object.values(PartnerCommissionType)),
  // Percent up to 100; per unit up to R$ 1000 (a typo guard).
  // Percent up to 100 (checked in PartnerService); per unit up to R$ 1000 (a typo guard).
  commissionValue: vine.number().min(0).decimal([0, 2]).max(1000),
  cancelPolicy: vine.enum(Object.values(PartnerCancelPolicy)),
})

export const partnerValidator = vine.create(partnerFields)

export const partnerPauseValidator = vine.create(vine.object({ paused: vine.boolean() }))

export const partnerCatalogValidator = vine.create(
  vine.object({
    mode: vine.enum(Object.values(PartnerCatalogMode)),
    categoryIds: vine.array(vine.number().withoutDecimals().positive()).maxLength(500),
    excludedItemIds: vine.array(vine.string().uuid()).maxLength(2000),
  })
)

export const partnerTerminalValidator = vine.create(
  vine.object({ partnerId: vine.string().uuid().nullable() })
)

const day = vine.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** A partner's board: another business day than today. */
export const partnerOrdersValidator = vine.create(vine.object({ date: day.clone().optional() }))

export const cancelRequestValidator = vine.create(
  vine.object({ reason: vine.string().trim().minLength(3).maxLength(300) })
)

export const cancelDecisionValidator = vine.create(
  vine.object({ note: vine.string().trim().maxLength(300).nullable().optional() })
)

/** Marks commission paid: up to a business day, or the orders picked. */
export const settlePartnerValidator = vine.create(
  vine.object({
    until: day.clone().optional().requiredIfMissing('orderIds'),
    orderIds: vine.array(vine.string().uuid()).minLength(1).maxLength(500).optional(),
    note: vine.string().trim().maxLength(300).nullable().optional(),
  })
)

/** A period of business days ("YYYY-MM-DD"), up to a year. */
export const partnerPeriodValidator = vine.create(
  vine.object({
    from: day.clone(),
    to: day.clone(),
  })
)
