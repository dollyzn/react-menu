import vine from '@vinejs/vine'
import StoreRole from '#enums/store_role'

const role = vine.enum(Object.values(StoreRole))

const addMemberValidator = vine.create(
  vine.object({
    email: vine.string().email().trim().normalizeEmail().maxLength(254),
    name: vine.string().trim().maxLength(80).optional(),
    role,
  })
)

const updateMemberValidator = vine.create(vine.object({ role }))

export { addMemberValidator, updateMemberValidator }
