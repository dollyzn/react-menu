import vine from '@vinejs/vine'
import StoreRole from '#enums/store_role'
import PartnerMemberRole from '#enums/partner_member_role'
import { partnerFields } from '#validators/partner'

const role = vine.enum(Object.values(StoreRole))

/** Role `partner` (ADR 0024): an existing partner, or a new one created with the invite. */
const partner = {
  partnerId: vine.string().uuid().optional(),
  newPartner: partnerFields.clone().optional(),
  partnerRole: vine.enum(Object.values(PartnerMemberRole)).optional(),
}

const addMemberValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().normalizeEmail().maxLength(254),
    name: vine.string().trim().maxLength(80).optional(),
    role,
    ...partner,
  })
)

const updateMemberValidator = vine.create(vine.object({ role, ...partner }))

const memberAccessValidator = vine.create(vine.object({ enabled: vine.boolean() }))

export { addMemberValidator, updateMemberValidator, memberAccessValidator }
